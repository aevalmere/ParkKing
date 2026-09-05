import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The launch page is the root of this repository's GitHub Pages site
// (https://aevalmere.github.io/ParkKing/): it builds into ../ (the repo
// root), which GitHub Pages serves verbatim. JS, CSS and fonts inline into
// one index.html; only ./public (film + poster + favicon) ships beside it.
// All asset references are relative, so the page works at any mount path,
// including the /ParkKing/ project-site prefix.
//
// emptyOutDir is OFF on purpose: the out dir is the repo root, which also
// holds the demo app (../parkkingdemo/), this source tree and ../docs/.
// Wiping it would delete them. The build only ever writes index.html plus
// a copy of ./public, and overwrites those in place.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: '..',
    emptyOutDir: false,
  },
})
