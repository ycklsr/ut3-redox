// Transport temporaire : reconstruction vérifiée, sans toucher à une autre branche.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { brotliDecompressSync } from 'node:zlib';
const root = fileURLToPath(new URL('../', import.meta.url));
const packed = Buffer.concat([0, 1, 2, 3].map(i => readFileSync(new URL('./pedagogy-payload-' + i + '.br', import.meta.url))));
const payload = JSON.parse(brotliDecompressSync(packed));
const path = resolve(root, 'redox.html');
const source = readFileSync(path);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
if (hash(source) !== payload.after) {
  if (hash(source) !== payload.before) throw new Error('La source a changé : ne pas écraser les modifications.');
  const chunks = [];
  let offset = 0;
  for (const [start, end, content] of payload.edits) {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < offset || end < start || end > source.length) throw new Error('Delta invalide.');
    chunks.push(source.subarray(offset, start), Buffer.from(content));
    offset = end;
  }
  chunks.push(source.subarray(offset));
  const output = Buffer.concat(chunks);
  if (hash(output) !== payload.after) throw new Error('Empreinte de sortie incorrecte.');
  writeFileSync(path, output);
}
for (const name of ['tests/pedagogie.test.mjs', 'PEDAGOGIE.md']) {
  const target = resolve(root, name);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, payload.files[name]);
}
console.log('Version pédagogique reconstruite et vérifiée : ' + payload.after);
