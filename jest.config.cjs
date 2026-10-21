module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.js', '**/?(*.)+(spec|test).js'],
  // Every source file counts, including the data extractors (tsvHelpers,
  // obsHelpers, taHelpers, …), so the threshold below reflects the whole library.
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/cli.js',
    '!src/fixtures/**',
    '!src/renderers/sofria2html.js',
    '!src/assets/**',
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
