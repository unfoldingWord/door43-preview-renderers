# PDF Service & App Rendering Integration — Architecture Plan

**Status:** planning · **Last updated:** 2026-07-01

This plan covers how to (a) make `door43-preview-app` render using the shared
`door43-preview-renderers` library instead of logic baked into React components
and hooks, and (b) turn PDF generation into a service that can handle many
concurrent users and very large resources (e.g. the Psalms Translation Notes,
currently ~5,000 pages).

## Locked decisions

- **v1 scope:** content-addressed **cache** + **async job queue** (skip chunked
  rendering / pre-generation for v1; they come later).
- **Orchestration lives in Node** (`door43-preview-app`): assemble HTML, hash,
  enqueue, talk to S3, serve status. **The WeasyPrint container stays a dumb,
  stateless HTML→PDF renderer.**
- Keep **PagedJS** as a client-side fallback/preview, not the workhorse.

## Two tracks and how they interlock

| Track | What | Why it matters |
|---|---|---|
| **1 — Renderers in the app** | Replace React-baked rendering with the `door43-preview-renderers` library | Single source of truth for rendering; and it's what lets the *server* assemble the exact print HTML the PDF service renders |
| **2 — PDF service** | Content-addressed cache + async queue + S3 delivery | Survives concurrency and 5,000-page docs |

Track 2 can **start** on the current "client POSTs HTML" contract (cache keyed
on the HTML sha — your original plan), so it is **not blocked** on Track 1
completing. Once Track 1 gives the Node app server-side assembly, Track 2
upgrades to a descriptor-based API (smaller payloads, server-driven
pre-generation). Recommended order: begin Track 1, land the cache early, then
the queue, migrating the API to descriptors as server-side assembly lands.

---

## Track 1 — Integrate `door43-preview-renderers` into `door43-preview-app`

### Current state (evidence)

- App renders client-side via per-resource components (`Bible.jsx`,
  `OpenBibleStories.jsx`, `RcTranslationWords.jsx`, `RcObsStudyNotes.jsx`,
  `RcStudyQuestions.jsx`, `RcObsTranslationQuestions.jsx`, …) plus
  `useGenerate*Html` / `useFetch*` / `usePivot*` hooks.
- App carries **duplicated** renderer logic already extracted into the package:
  `src/renderer/sofria2html.js`, `src/utils/translationNotesRenderer.js`, and
  helpers like `renderStyles.js` / `previewStyling.js`.
- App does **not** depend on `door43-preview-renderers` yet.
- The package already covers a broad set of subjects (Aligned Bible, Bible,
  GNT/HOT, Open Bible Stories, Translation Academy, TSV Translation/Study
  Notes & Questions, Translation Words, TWL, OBS variants) via the
  `getResourceData` subject dispatch — so this is mostly wiring, not porting.

### Distribution: how the app consumes the package

Recommendation: **publish `door43-preview-renderers` as a versioned npm package**
(public npm or GitHub Packages under `@unfoldingword/`), and depend on it with a
pinned version. Clean semver, reproducible Docker builds, and the styleguide and
app share one source.

- **Interim / faster:** a pinned **git dependency** (`git+https://…#<tag>`), which
  `pnpm install` handles inside the Docker build with no registry setup.
- **Avoid** a local file link or copy — that's how the duplicated files happened.

> Decision needed: npm publish vs git-tag dependency (see Open Decisions).

### What replaces what

- **Rendering:** the per-resource `useGenerate*Html` hooks and the rendering
  bodies of the components → `renderHtmlData(resourceData)` + `renderHTML(htmlData, opts)`.
- **Data + parsing:** the `useFetch*` / `usePivot*` / `ts2usfm` / `sofria2html`
  logic → `getAllCatalogEntries()` + `getResourceData()` (the pipeline's fetch +
  parse stages).
- **Delete** the app's duplicated `src/renderer/sofria2html.js`,
  `src/utils/translationNotesRenderer.js`, and any style helpers now owned by the
  package.

### How the React app shows renderer output

`renderHTML()` returns an HTML string. The React components become **thin shells**
that run the pipeline and inject the HTML into a container (or an `<iframe>` for
strong style isolation — the app already uses an iframe for the WeasyPrint
preview). No more per-resource JSX composition.

Same functions run **server-side** in the Express app to assemble the exact
print HTML the PDF service will render — that's the bridge into Track 2.

### Migration strategy: strangler-fig, per resource type

1. Add the dependency; stand up a single `RenderedResource` shell that calls the
   pipeline for one resource type (start with a Bible or OBS).
2. Route that type through the package; **fall back to the existing React
   rendering for types not yet switched over.** Ship type-by-type.
3. As each type flips, delete its old hook/component rendering body and any
   duplicated renderer file.
4. When all types are switched, remove the fallback path.

This de-risks the migration and lets the PDF service light up per type as it
converts.

---

## Track 2 — The PDF service

### Architecture

```
                         ┌─────────────────────────────────────────────┐
  Browser / Netlify      │              door43-preview-app (Node)        │
  ────────────────►      │  POST /api/pdf   {descriptor | HTML}          │
   "render Psalms TN"    │     │                                         │
                         │     ├─ assemble print HTML (renderers)        │
                         │     ├─ key = sha256(printHTML) + engineVer     │
                         │     ├─ S3 HEAD key? ── HIT ──────────────────► │ 200 {url}
                         │     │                                         │
                         │     └─ MISS: enqueue (job id = key = dedup) ──►│ 202 {jobId}
                         │                          │                     │
   GET /api/pdf/:id ◄────┤   status from Redis ◄────┤                     │
   {state,eta,url?,err?} └──────────────────────────┼─────────────────────┘
                                                     │ Redis (BullMQ)
                                          ┌──────────▼────────────┐
                                          │  N render workers      │  scale =
                                          │  Node worker           │  more
                                          │   → WeasyPrint sidecar │  containers
                                          │   → upload S3          │
                                          │   → mark job done      │
                                          └──────────┬────────────┘
                                                     ▼
                                            S3 (+ CDN)  ──► client downloads PDF
```

### Component choices

| Concern | Choice | Notes |
|---|---|---|
| Queue + job state | **Redis / BullMQ** | Redis already runs for DCS — use a **separate DB index or instance** to isolate keyspace |
| Orchestration | **Node** | HTML assembly + hashing are JS; keep the brains here |
| Renderer | **WeasyPrint sidecar, unchanged** | Node worker calls it over the docker network; a long internal hold is fine (not client-facing) |
| Storage | **S3, content-addressed** `pdf/<sha256(printHTML)>-<engineVer>.pdf` | Automatic dedup; durable; shareable; survives restarts |
| Delivery | **Presigned S3 URL or CloudFront** | App isn't in the download data path |

### Request lifecycle

1. `POST /api/pdf`. **v1 contract:** to avoid shipping megabytes of HTML on
   cache hits, the client computes `sha256(printHTML)` locally and first calls a
   cheap `GET /api/pdf/exists?key=<sha>`; it POSTs the full HTML only on a miss.
   **v2 contract (post Track 1):** client sends a small **descriptor**
   (`{repo, ref, bookList, pageSize, columns, direction}`) and the server
   assembles + hashes + checks — smaller payloads and enables pre-generation.
2. **Cache hit** → `200 {url}` immediately.
3. **Cache miss** → enqueue, `202 {jobId}`. **Dedup:** job id = cache key, so a
   second request for an already-rendering PDF attaches to the same job (both
   clients poll it). Critical for popular content; near-free with BullMQ.
4. Worker renders → uploads to S3 → marks job `done` with the URL.
5. `GET /api/pdf/:id` → `{state, queuePosition, etaSeconds, url?, error?}`.

### Status & ETA — what's realistically achievable

WeasyPrint renders a document as one synchronous blob and does not emit
page-by-page progress. So:

- **Coarse states are reliable:** `queued(position N) → rendering → uploading → done|failed`.
- **A useful *estimate* (not a live %):** record `pages` and `renderMs` per
  completed job; keep a rolling **avg ms/page per subject** (TN ≠ OBS); estimate
  `eta = estPages × avgMsPerPage + queueWait`. Estimate `estPages` from a prior
  render of the same resource at another version, or HTML byte size as a proxy.
  Fuzzy for a never-seen resource; tightens with data. Present as a range
  ("~3–6 min"), not a fake countdown.
- **A true progress %** requires chunked rendering (v2 — see below).

### Concurrency, failure, protection

- Worker concurrency **1–2 per worker**, memory-limited; scale by adding worker
  containers via `docker::run`.
- BullMQ **retries with backoff**; dead-letter poison jobs; on worker OOM the job
  is retried or marked failed (Redis persists the queue).
- Guard rails: a max-pages/size threshold with a clear message so one pathological
  request can't monopolize the pool.

---

## The 5,000-page (Psalms TN) problem

Three compounding tactics, in leverage order:

1. **Cache** — render once per version; everyone after gets it instantly. Fixes
   the large majority of the pain by itself.
2. **Pre-generate (cache warming, v2)** — the content set is known and finite. A
   cron job (the deploy already runs `profile::dcs::cronjobs`) re-renders
   popular/all resources after each catalog update, so the cold giant render
   happens on a schedule, never while a user waits.
3. **Chunked render + merge (v2, for the true outliers)** — split by book/chapter,
   render chunks in parallel, merge with `pikepdf`/`pypdf`. Wins: parallelism cuts
   wall-clock, smaller per-render memory (no OOM), real progress %, retry a single
   failed chunk. **Caveat:** WeasyPrint numbers pages per-document, so merging
   breaks global page numbers, TOC page targets, and running-header continuity —
   it needs a final numbering/TOC pass once chunk page-counts are known. Ship
   single-document rendering first; chunk only the monsters later.

## PagedJS vs the service — when to use which

| | PagedJS (client) | WeasyPrint service (server) |
|---|---|---|
| Server load | none | needs workers |
| Big docs (Psalms) | painfully slow, double-render, tab must stay open | the only sane option |
| Output | local print dialog, not shareable | durable S3 URL, mobile-friendly, linkable |
| Offline / static Netlify | works with no backend | needs the service |
| Best for | small docs, quick preview, no-backend demo | everything non-trivial; the default |

Keep PagedJS for the static demo and quick small previews; route real output
through the service.

---

## Deployment (Puppet / Docker, no k8s)

- **Redis for the queue:** reuse the existing instance with a **dedicated DB
  index** (isolate from DCS) or a small dedicated instance.
- **Worker containers:** new `docker::run` definitions for N Node render workers
  (each talks to the WeasyPrint sidecar). Scale = replica count. Develop-first,
  same `enable_weasyprint` gating pattern.
- **S3 + credentials:** this is the phase that **re-adds the AWS creds** deferred
  earlier — create the `preview-app` openbao secrets (`aws_access_key_id`,
  `aws_access_key_secret`, `s3_bucket`) and wire them into the app/worker env
  (ideally behind their own flag).
- **CDN:** optional CloudFront in front of the S3 bucket for downloads.
- **WeasyPrint sidecar:** unchanged (dumb renderer). Its memory limit still needs
  to fit the largest *single* render until chunking lands — size accordingly, or
  gate very large single-doc renders behind a threshold.

---

## Milestones

- **M0 — Dependency + one type:** app depends on the package; one resource type
  renders through the pipeline (server + client), fallback for the rest.
- **M1 — Cache (Track 2 Phase A):** S3 content-addressed cache + `exists` check on
  the current POST-HTML contract. Re-add AWS creds/secrets. Repeats become
  instant.
- **M2 — Async queue (Track 2 Phase B):** BullMQ/Redis, `202 + jobId`, status
  endpoint, worker containers, in-flight dedup, retries.
- **M3 — Finish Track 1:** convert remaining resource types; delete duplicated
  renderer files and old hooks; remove fallback.
- **M4 — Descriptor API:** move `POST /api/pdf` to descriptors (server-side
  assembly), enabling pre-generation.
- **M5 — Scale & UX:** cache-warming cron, chunked render for outliers, ms/page
  ETA, CDN.

## Open decisions

1. **Renderers distribution:** npm publish (`@unfoldingword/…`) vs pinned
   git-tag dependency. (Recommend npm publish; git tag as interim.)
2. **Redis:** shared instance + dedicated DB index vs a separate queue instance.
3. **S3 layout & lifecycle:** bucket/prefix, retention (evict old versions?), and
   whether to front with CloudFront now or later.
4. **Descriptor schema:** the canonical request shape for M4 (repo, ref, book
   list, page size, columns, direction, engine version).
5. **Single-render size ceiling:** the page/byte threshold above which a request
   is rejected (pre-chunking) and the worker memory limit that implies.

## Appendix — API sketch

```
POST /api/pdf
  body: text/html  (v1)   |   application/json {descriptor}  (v2)
  200 {url}                # cache hit
  202 {jobId, statusUrl}   # queued (jobId == cache key)

GET /api/pdf/exists?key=<sha256>-<engineVer>
  200 {exists: true, url} | 200 {exists: false}

GET /api/pdf/:id
  200 {
    state: "queued"|"rendering"|"uploading"|"done"|"failed",
    queuePosition?: number,
    etaSeconds?: number,      # estimate; range in UI
    url?: string,             # when done
    error?: string            # when failed
  }
```
