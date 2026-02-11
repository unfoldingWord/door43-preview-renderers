module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  collectCoverageFrom: [
    'src/getAllCatalogEntriesForRendering.js',
    'src/getResourceData.js',
    'src/renderHtmlData.js',
    'src/dcsApi.js',
    'src/api/client.js',
    'src/index.js',
    'src/renderers/**/*.js',
    '!src/renderers/sofria2html.js',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coveragePathIgnorePatterns: ['/node_modules/', '/.history/', '/dist/', '/styleguide/'],
  testPathIgnorePatterns: ['/node_modules/', '/.history/', '/dist/', '/styleguide/'],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
