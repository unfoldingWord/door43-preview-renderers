const path = require('path');
const { pathToFileURL } = require('url');

// WeasyPrint is a server-side (Python) tool — it cannot run in the browser where
// the demos execute. So the styleguide dev server exposes a small endpoint that
// accepts a renderHtmlData() result + PDF options, runs renderPdf() (assemble +
// WeasyPrint) in Node, and streams the PDF back for the demo to embed in an iframe.
// Requires the `weasyprint` binary on PATH (pipx install weasyprint / brew install weasyprint).
const LIB_URL = pathToFileURL(path.resolve(__dirname, 'src/index.js')).href;
const MAX_PDF_BODY = 96 * 1024 * 1024; // 96 MB — a full book's sections can be large

function registerPdfEndpoint(app) {
  if (!app || typeof app.post !== 'function') return;
  app.post('/api/render-pdf', (req, res) => {
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (chunk) => {
      if (aborted) return;
      size += chunk.length;
      if (size > MAX_PDF_BODY) {
        aborted = true;
        res.status(413).json({ error: 'Payload too large' });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', async () => {
      if (aborted) return;
      try {
        // Same contract as the hosted weasyprint-pdf service (services/weasyprint-pdf):
        // POST the complete print HTML, get back PDF bytes. The client assembles the
        // print HTML via renderHTML(htmlData, { media: 'print' }).
        const html = Buffer.concat(chunks).toString('utf8');
        const { generatePdf } = await import(LIB_URL);
        const pdf = await generatePdf(html, { quiet: true });
        const buf = Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
        res.setHeader('Content-Length', buf.length);
        res.end(buf);
      } catch (err) {
        res.status(500).json({ error: err && err.message ? err.message : String(err) });
      }
    });
    req.on('error', () => {
      if (!res.headersSent) res.status(400).json({ error: 'Request stream error' });
    });
  });
}

module.exports = {
  title: 'Door43 Preview Renderers',
  // Shown under the title in the sidebar; read from package.json so it stays in sync.
  version: require('./package.json').version,
  webpackConfig: {
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          loader: 'babel-loader',
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      alias: {
        'door43-preview-renderers': path.resolve(__dirname, 'src/index.js'),
      },
    },
    // webpack-dev-server v4: register the /api/render-pdf endpoint once the express
    // app exists. (Styleguidist's `configureServer` hook receives an undefined app
    // in this wds version because it runs before the server starts.)
    devServer: {
      setupMiddlewares: (middlewares, devServer) => {
        registerPdfEndpoint(devServer.app);
        return middlewares;
      },
    },
  },
  styleguideDir: 'styleguide',
  pagePerSection: true,
  // Sections are ordered to mirror the rendering pipeline:
  //   getAllCatalogEntries → getResourceData → renderHtmlData → renderHTML → renderPdf
  // followed by reference material.
  sections: [
    {
      name: 'Introduction',
      content: 'docs/introduction.md',
    },
    {
      name: 'Full Pipeline',
      content: 'docs/pipeline.md',
      components: 'src/PipelineDemo.jsx',
    },
    {
      name: 'The pipeline',
      sections: [
        {
          name: '1 · Get All Catalog Entries',
          content: 'docs/get-all-catalog-entries.md',
          components: 'src/GetAllCatalogEntriesDemo.jsx',
        },
        {
          name: '2 · Get Resource Data',
          content: 'docs/get-resource-data.md',
          components: 'src/GetResourceDataDemo.jsx',
        },
        {
          name: '3 · Render HTML Data',
          content: 'docs/renderers.md',
          components: 'src/RenderHtmlDataDemo.jsx',
        },
        {
          name: '4 · Render HTML',
          content: 'docs/render-html.md',
          components: 'src/RenderHTMLDemo.jsx',
        },
        {
          name: '5 · Render PDF',
          content: 'docs/render-pdf.md',
          components: 'src/RenderPDFDemo.jsx',
        },
      ],
    },
    {
      name: 'Reference',
      sections: [
        {
          name: 'Rendering Options',
          content: 'docs/options.md',
        },
        {
          name: 'CLI',
          content: 'docs/cli.md',
        },
        {
          name: 'Constants',
          content: 'docs/constants.md',
        },
        {
          name: 'Converters',
          content: 'docs/converters.md',
        },
        {
          name: 'API Client',
          content: 'docs/api.md',
        },
      ],
    },
  ],
  template: {
    head: {
      links: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
        },
      ],
    },
  },
  theme: {
    color: {
      base: '#333',
      light: '#999',
      lightest: '#ccc',
      link: '#1978c8',
      linkHover: '#f28a25',
      border: '#e8e8e8',
      name: '#7f9a44',
      type: '#b77daa',
      error: '#c00',
      baseBackground: '#fff',
      sidebarBackground: '#f5f5f5',
    },
    fontFamily: {
      base: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
  },
  usageMode: 'expand',
  exampleMode: 'expand',
};
