import typescript from 'rollup-plugin-typescript2';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/sdk/index.ts',
  output: [
    {
      file: 'dist/insight-lite.js',
      format: 'umd',
      name: 'InsightLite',
      sourcemap: true
    },
    {
      file: 'dist/insight-lite.min.js',
      format: 'umd',
      name: 'InsightLite',
      sourcemap: true,
      plugins: [terser()]
    },
    {
      file: 'dist/insight-lite.esm.js',
      format: 'esm',
      sourcemap: true
    }
  ],
  plugins: [
    typescript({
      tsconfig: 'tsconfig.sdk.json',
      useTsconfigDeclarationDir: true
    })
  ],
  external: []
};