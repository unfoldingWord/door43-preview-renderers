// Live tests against the real DCS (`pnpm test:live`). Opt-in: they need the
// network and take minutes, so the default run (jest.config.cjs) leaves them
// out, and CI runs them only nightly or by hand (.github/workflows/live.yml).
const base = require('./jest.config.cjs');

module.exports = {
  ...base,
  testMatch: ['**/src/__live__/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/.history/', '/dist/', '/styleguide/', '/.claude/'],
  collectCoverage: false,
  coverageThreshold: undefined,
  testTimeout: 300000,
};
