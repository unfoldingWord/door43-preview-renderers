# Full Pipeline

The renderer is a **composable chain** — each stage takes the previous stage's
output, so you can run the whole thing or resume from any cached intermediate. Stage 2
can also read repositories checked out on disk (`getResourceDataFromDirectory`, see
[Get Resource Data](./get-resource-data.md)):

```
resolveResource(query, opts)         → owner/repo/ref  (network; stage 0, optional: language + subject → publisher + release)
getAllCatalogEntries(source, opts)   → CatalogSet      (network)
getResourceData(input, opts)         → ResourceData    (network; or a cached ResourceData passed through)
renderHtmlData(resourceData, opts)   → HtmlData        (pure, no I/O)
renderHTML(htmlData, opts)           → HTML string     (media: 'screen' | 'print')
renderPdf(htmlData, opts)            → PDF             (WeasyPrint)
```

Stage 0 is for callers that know a language rather than a repository: `getAllCatalogEntries({ lang, subject, books })` runs it for you and keeps the blueprint it fetched as the CatalogSet. See [Find Resources](./find-resources.md).

The demo below loads a **cached `ResourceData` fixture** (instant — no DCS round-trip
and no in-browser Proskomma) or fetches **live from DCS**, then runs
`renderHtmlData → renderHTML`. Because stages 3–4 are pure, flipping between the web
and print views re-renders instantly **without re-fetching** — the payoff of the
staged design.

See [Rendering Options](./options.md) for everything each stage accepts.
