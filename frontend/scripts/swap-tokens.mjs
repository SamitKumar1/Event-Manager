// Sweep old color tokens → new semantic tokens across all page files.
// One-time script. Maps per the design-system plan (off-palette → semantic).
// Run from /Users/samitkumar/event-platform/frontend.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const PAGES_DIR = resolve('src/pages');

// Patterns to swap. Order matters: more-specific patterns first.
//   bg-{family}-{shade} | text-{family}-{shade} | border-{family}-{shade}
//   The mapping table from the design plan.

const SUBS = [
  // Neutrals
  [/\bbg-white\b/g, 'bg-surface'],
  [/\bbg-gray-50\b/g, 'bg-bg'],
  [/\bbg-gray-100\b/g, 'bg-surface-2'],
  [/\bbg-gray-200\b/g, 'bg-surface-2'],
  [/\bborder-gray-100\b/g, 'border-border'],
  [/\bborder-gray-200\b/g, 'border-border'],
  [/\bborder-gray-300\b/g, 'border-border'],
  [/\btext-gray-400\b/g, 'text-text-subtle'],
  [/\btext-gray-500\b/g, 'text-text-muted'],
  [/\btext-gray-600\b/g, 'text-text-muted'],
  [/\btext-gray-700\b/g, 'text-text-muted'],
  [/\btext-gray-800\b/g, 'text-text'],
  [/\btext-gray-900\b/g, 'text-text'],

  // Danger (red)
  [/\bbg-red-50\b/g, 'bg-danger-soft'],
  [/\bbg-red-100\b/g, 'bg-danger-soft'],
  [/\btext-red-600\b/g, 'text-danger'],
  [/\btext-red-700\b/g, 'text-danger'],
  [/\btext-red-800\b/g, 'text-danger'],
  [/\bborder-red-200\b/g, 'border-danger'],

  // Success (green)
  [/\bbg-green-50\b/g, 'bg-success-soft'],
  [/\bbg-green-100\b/g, 'bg-success-soft'],
  [/\btext-green-600\b/g, 'text-success'],
  [/\btext-green-700\b/g, 'text-success'],
  [/\btext-green-800\b/g, 'text-success'],
  [/\bborder-green-200\b/g, 'border-success'],

  // Info (blue)
  [/\bbg-blue-50\b/g, 'bg-info-soft'],
  [/\bbg-blue-100\b/g, 'bg-info-soft'],
  [/\btext-blue-600\b/g, 'text-info'],
  [/\btext-blue-700\b/g, 'text-info'],
  [/\btext-blue-800\b/g, 'text-info'],

  // Warning (yellow)
  [/\bbg-yellow-100\b/g, 'bg-warning-soft'],
  [/\btext-yellow-800\b/g, 'text-warning'],

  // Other one-offs → collapse to warning/danger/info-soft
  [/\bbg-orange-100\b/g, 'bg-warning-soft'],
  [/\btext-orange-800\b/g, 'text-warning'],
  [/\bbg-rose-100\b/g, 'bg-danger-soft'],
  [/\btext-rose-800\b/g, 'text-danger'],
  [/\bbg-purple-100\b/g, 'bg-info-soft'],
  [/\btext-purple-800\b/g, 'text-info'],
  [/\bbg-indigo-100\b/g, 'bg-info-soft'],
  [/\btext-indigo-800\b/g, 'text-info'],
];

const files = (await readdir(PAGES_DIR)).filter((f) => f.endsWith('.tsx'));

let totalChanged = 0;

for (const f of files) {
  const p = join(PAGES_DIR, f);
  const src = await readFile(p, 'utf8');
  let next = src;
  for (const [re, replacement] of SUBS) {
    next = next.replace(re, replacement);
  }
  if (next !== src) {
    await writeFile(p, next);
    totalChanged++;
    console.log(`  updated ${f}`);
  }
}

console.log(`\n${totalChanged} of ${files.length} page files updated.`);
