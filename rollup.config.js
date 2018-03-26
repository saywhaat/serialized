import babel from 'rollup-plugin-babel'
import { main, module } from './package.json'

export default {
  input: './src/index.js',
  output: [
    {
      file: module,
      format: 'es',
    },
    {
      file: main,
      format: 'cjs',
    },
  ],
  plugins: [babel()],
}
