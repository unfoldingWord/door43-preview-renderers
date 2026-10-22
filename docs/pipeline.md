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
renderPreview(request)               → HTML | PDF      (all of the above in one call)
```

Stage 0 is for callers that know a language rather than a repository: `getAllCatalogEntries({ lang, subject, books })` runs it for you and keeps the blueprint it fetched as the CatalogSet. See [Find Resources](./find-resources.md).

The demo below loads a **cached `ResourceData` fixture** (instant — no DCS round-trip
and no in-browser Proskomma) or fetches **live from DCS**, then runs
`renderHtmlData → renderHTML`. Because stages 3–4 are pure, flipping between the web
and print views re-renders instantly **without re-fetching** — the payoff of the
staged design.

See [Rendering Options](./options.md) for everything each stage accepts.

## One call: `renderPreview(request)`

When only the result matters, `renderPreview` runs the chain for you. The request
names the resource the way `getAllCatalogEntries` does, carries every stage's
options in the same object (each stage reads its own), and says what to return:

```js static
import { renderPreview } from '@unfoldingword/door43-preview-renderers';

// The latest release of a repository, as a web page.
const html = await renderPreview({ owner: 'unfoldingWord', repo: 'en_tn', books: ['tit'] });

// A language and a subject, as a PDF with each verse's questions.
await renderPreview({
  lang: 'en',
  subject: 'TSV Translation Notes',
  books: ['tit'],
  extraSubjects: ['TSV Translation Questions'],
  output: 'pdf',
  outputPath: 'tit_tn.pdf',
});
```

| Key | Default | |
|---|---|---|
| `owner`, `repo`, `ref`, `books` | | The resource, as stage 1 takes it. No `ref`: the latest release (the default branch if there is none). |
| `lang`, `subject`, `owner`, `stage`, `ref`, `books` | | Or find it from a language (stage 0). |
| `output` | `'html'` | `'html'`: the document `renderHTML` composes (`media: 'screen'` or `'print'`). `'pdf'`: `renderPdf`, with the local WeasyPrint or `pdfServiceUrl`. |
| anything else | | Passed to the stages: `dcsApiUrl`, `quiet`, `extraSubjects` (stage 2), `renderOptions` (stage 3), `media`, `show`, `columns`, `print` (stage 4), `outputPath`, `pdfServiceUrl`, … (stage 5). |

It returns the HTML string, or the PDF bytes (the path when `outputPath` is given).
The blueprint is fetched once. To keep or cache an intermediate (the CatalogSet,
ResourceData or HtmlData), call the stages yourself.
