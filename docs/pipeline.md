# Full Pipeline

The renderer is a **composable chain** — each stage takes the previous stage's
output, so you can run the whole thing or resume from any cached intermediate (reading
checked-out repositories from disk, `getResourceDataFromDirectory`, is still planned —
see [Rendering Options](./options.md)):

```
getAllCatalogEntries(source, opts)   → CatalogSet      (network)
getResourceData(input, opts)         → ResourceData    (network; or a cached ResourceData passed through)
renderHtmlData(resourceData, opts)   → HtmlData        (pure, no I/O)
renderHTML(htmlData, opts)           → HTML string     (media: 'screen' | 'print')
renderPdf(htmlData, opts)            → PDF             (WeasyPrint)
```

The demo below loads a **cached `ResourceData` fixture** (instant — no DCS round-trip
and no in-browser Proskomma) or fetches **live from DCS**, then runs
`renderHtmlData → renderHTML`. Because stages 3–4 are pure, flipping between the web
and print views re-renders instantly **without re-fetching** — the payoff of the
staged design.

See [Rendering Options](./options.md) for everything each stage accepts.
