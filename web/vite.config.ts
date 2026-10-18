// SPDX-License-Identifier: Apache-2.0
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // The shared crypto module lives in ../api, outside the Vite root.
  server: { proxy: { '/api': 'http://localhost:8787' }, fs: { allow: ['..'] } },
});
