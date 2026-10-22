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
    // Re-exports only (no statements to count); the export test checks it.
    '!src/index.js',
    // Example data for the styleguide demos, not part of the package.
    '!src/demoExamples.js',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  coveragePathIgnorePatterns: ['/node_modules/', '/.history/', '/dist/', '/styleguide/'],
  // src/__live__ needs the network: `pnpm test:live` (jest.live.config.cjs).
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.history/',
    '/dist/',
    '/styleguide/',
    '/src/__live__/',
  ],
  // A few points under the measured totals (2026-10-22: statements 89.4,
  // branches 78.0, functions 88.7, lines 92.0), so a real drop fails CI while
  // small swings do not. Raise them as coverage grows.
  coverageThreshold: {
    global: {
      branches: 72,
      functions: 85,
      lines: 87,
      statements: 85,
    },
  },
};
