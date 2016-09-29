import buble from 'rollup-plugin-buble';
import builtins from 'rollup-plugin-node-builtins';
import commonjs from 'rollup-plugin-commonjs';
import resolve from 'rollup-plugin-node-resolve';

export default {
  dest: './dist/d3-model.js',
  entry: 'index.js',
  format: 'umd',
  moduleName: 'd3',
  plugins: [
    builtins(),
    resolve({
      jsnext: true
    }),
    commonjs({
      exclude: ['**/lodash-es/**']
    }),
    buble()
  ]
};
