module.exports = {
  title: 'Door43 Preview Renderers',
  components: 'src/components/**/*.{js,jsx}',
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
      alias: {
        'door43-preview-renderers': require('path').resolve(__dirname, 'src/index.js'),
      },
    },
  },
  styleguideDir: 'styleguide',
  pagePerSection: true,
  sections: [
    {
      name: 'Introduction',
      content: 'docs/introduction.md',
    },
    {
      name: 'Constants',
      content: 'docs/constants.md',
    },
    {
      name: 'Get Resource Data',
      content: 'docs/get-resource-data.md',
      components: 'src/GetResourceDataDemo.jsx',
    },
    {
      name: 'Get All Catalog Entries For Rendering',
      content: 'docs/get-all-catalog-entries-for-rendering.md',
      components: 'src/GetAllCatalogEntriesForRenderingDemo.jsx',
    },
    {
      name: 'Renderers',
      content: 'docs/renderers.md',
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
