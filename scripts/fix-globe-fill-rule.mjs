import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const files = [
  resolve(process.cwd(), 'src/generated/mastery-runtime.js'),
  resolve(process.cwd(), 'src/generated/atlas-globe.js')
];

for (const file of files) {
  let source = await readFile(file, 'utf8');
  const before = source;
  source = source
    .replaceAll('context.fill("evenodd");', 'context.fill();')
    .replaceAll("context.fill('evenodd');", 'context.fill();');

  if (source === before) {
    throw new Error(`Expected an even-odd globe fill in ${file}, but none was found.`);
  }
  if (/context\.fill\(["']evenodd["']\)/.test(source)) {
    throw new Error(`The even-odd globe fill rule remains in ${file}.`);
  }

  await writeFile(file, source, 'utf8');
}

console.log('Corrected Atlas and Mastery canvas fill rules.');
