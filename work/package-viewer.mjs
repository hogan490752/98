import fs from 'node:fs/promises';
import {build} from 'esbuild';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const result = await build({entryPoints:[path.join(dir, 'viewer.mjs')], bundle:true,
  write:false, format:'iife', minify:true, target:['es2020']});
const template = await fs.readFile(path.join(dir, 'viewer-template.html'), 'utf8');
const script = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
await fs.writeFile(path.join(dir, '../outputs/apartment-viewer.html'),
  template.replace('/*BUNDLED_SCRIPT*/', () => script));
console.log(`Offline viewer: ${result.outputFiles[0].contents.byteLength} script bytes`);
