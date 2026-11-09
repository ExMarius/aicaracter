#!/usr/bin/env node
/** Verifică sintaxa tuturor fișierelor .js din proiect (fără să ruleze nimic). */
import { execFile } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['src', 'tests', 'scripts'];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = DIRS.flatMap((d) => {
  const full = path.join(ROOT, d);
  try {
    return walk(full);
  } catch {
    return [];
  }
});

let failed = 0;
await Promise.all(
  files.map(
    (file) =>
      new Promise((resolve) => {
        execFile(process.execPath, ['--check', file], (err, stdout, stderr) => {
          if (err) {
            failed += 1;
            console.error(`✗ ${path.relative(ROOT, file)}\n${stderr || err.message}`);
          }
          resolve();
        });
      }),
  ),
);

console.log(`${files.length - failed}/${files.length} fișiere sunt valide sintactic.`);
process.exit(failed ? 1 : 0);
