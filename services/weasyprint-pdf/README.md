# weasyprint-pdf service

A tiny, stateless **HTML → PDF** HTTP service backed by [WeasyPrint](https://weasyprint.org/).
It exists so environments that can't run the `weasyprint` binary locally — a browser
(the static Netlify styleguide), or a serverless host — can still get a real,
high-fidelity WeasyPrint PDF.

All rendering/assembly is done by the `door43-preview-renderers` library; this
service is intentionally dumb: it pipes the posted HTML to `weasyprint - -` and
streams back the PDF.

## API

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/` | `Content-Type: text/html` — a complete HTML document | `200 application/pdf` |
| `GET` | `/health` | — | `200 "ok"` |
| `OPTIONS` | `*` | — | `204` (CORS preflight) |

On failure it returns `4xx`/`5xx` with a short text body (e.g. WeasyPrint stderr).

### Environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Listen port |
| `ALLOW_ORIGIN` | `*` | `Access-Control-Allow-Origin` — **set to your site origin in production** |
| `MAX_BODY_BYTES` | `33554432` (32 MB) | Reject larger request bodies |
| `TIMEOUT_MS` | `120000` | Kill a WeasyPrint run after this long |
| `WEASYPRINT_BIN` | `weasyprint` | Path to the binary |

## Run locally

```bash
docker build -t weasyprint-pdf services/weasyprint-pdf
docker run --rm -p 8080:8080 -e ALLOW_ORIGIN='*' weasyprint-pdf

# smoke test
printf '<!doctype html><h1>Hello PDF</h1>' \
  | curl -s -X POST --data-binary @- -H 'Content-Type: text/html' \
    http://localhost:8080 -o out.pdf && file out.pdf
```

## Published image (CI)

`.github/workflows/weasyprint-image.yml` builds this Dockerfile and pushes it to
the Door43 registry on every change to `services/weasyprint-pdf/**` on `main`
(and on manual dispatch):

- **Image:** `hub.door43.org/door43-preview-weasyprint`
- **Tags:** `latest` (default branch) and `sha-<short>` (immutable, pinnable)
- **Required repo secrets:** `DOCKER_BUILD_USERNAME`, `DOCKER_BUILD_TOKEN`

```bash
docker run --rm -p 8080:8080 -e ALLOW_ORIGIN='https://your-site.netlify.app' \
  hub.door43.org/door43-preview-weasyprint:latest
```

> If the registry requires a project/namespace, adjust `IMAGE` in the workflow
> (e.g. `hub.door43.org/<project>/door43-preview-weasyprint`).

## Deploy

Netlify can't host this (no Python runtime, no containers). Use any container host:

- **Fly.io:** `fly launch` in this dir (it detects the Dockerfile), then
  `fly deploy`. Set `fly secrets set ALLOW_ORIGIN=https://your-site.netlify.app`.
- **Render / Railway:** new Web Service → "Deploy from Dockerfile" → root
  `services/weasyprint-pdf`.
- **Google Cloud Run:** `gcloud run deploy weasyprint-pdf --source services/weasyprint-pdf --allow-unauthenticated`.

## Wire it into the renderer / styleguide

- **Library / CLI:** pass the URL as `pdfServiceUrl`:
  ```js
  await renderPdf(htmlData, { pdfServiceUrl: 'https://weasyprint-pdf.example.com', outputPath: 'out.pdf' });
  ```
  ```bash
  node src/cli.js generatePdf --owner unfoldingWord --repo en_tn --ref v89 --book tit \
    --pdf-service-url https://weasyprint-pdf.example.com --output tit.pdf
  ```
- **Styleguide Render PDF demo:** paste the URL into the "PDF service URL" field —
  the WeasyPrint panel will then work even on the static deploy.

## Security notes

This endpoint renders arbitrary posted HTML. In production:

- Set `ALLOW_ORIGIN` to your exact site origin (not `*`).
- Put it behind auth / a token, or restrict by network, if it isn't public-by-design.
- Keep `MAX_BODY_BYTES` and `TIMEOUT_MS` tight; run with limited CPU/memory.
- WeasyPrint can fetch remote resources referenced by the HTML — consider running
  with no outbound network if you don't need it.
