import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const MAX_LINES = 400;
const ROOT = join(process.cwd(), 'src');

const violations: { file: string; lines: number }[] = [];

function scan(dir: string) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(full);
      continue;
    }
    if (!['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))) continue;

    const content = readFileSync(full, 'utf8');
    const lines = content.split('\n').length;

    if (lines > MAX_LINES) {
      violations.push({ file: full.replace(process.cwd(), ''), lines });
    }
  }
}

scan(ROOT);

if (violations.length > 0) {
  console.error(`\n${violations.length} file(s) exceed ${MAX_LINES} lines:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}: ${v.lines} lines`);
  }
  console.error(`\nSplit these files into smaller modules.\n`);
  process.exit(1);
}

console.log(`All ${countFiles()} files under ${MAX_LINES} lines.`);

function countFiles(): number {
  let count = 0;
  function countDir(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        countDir(full);
      } else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))) {
        count++;
      }
    }
  }
  countDir(ROOT);
  return count;
}
