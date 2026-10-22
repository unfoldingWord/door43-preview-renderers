module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  // Build output, local scratch and generated files (see .prettierignore).
  ignorePatterns: [
    'dist/',
    'coverage/',
    'styleguide/',
    'tmp/',
    '.claude/',
    'src/fixtures/',
    'src/assets/logos.generated.js',
  ],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      // Command-line scripts report on stdout.
      files: ['scripts/**'],
      rules: { 'no-console': 'off' },
    },
  ],
};
