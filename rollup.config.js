import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

// Ship only this library's code. Its dependencies are installed next to it by
// the consumer's package manager (they are in `dependencies`), so bundling them
// would give an app a second copy of each (#32). Node built-ins stay imports too.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const dependencies = Object.keys(pkg.dependencies || {});
const builtins = new Set([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);
const external = (id) =>
  builtins.has(id) || dependencies.some((dep) => id === dep || id.startsWith(`${dep}/`));

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
  ],
  external,
  plugins: [
    json(),
    resolve(),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
      presets: ['@babel/preset-env', '@babel/preset-react'],
    }),
  ],
};
