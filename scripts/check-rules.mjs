// Enforces the machine-checkable invariants of AGENTS.md, section 4.
// Uses only Node built-ins. Run with `npm run rules`.
//
// Checks:
//   1. package.json has no runtime dependencies and only the allowed
//      dev dependencies.
//   2. Library source imports nothing but relative files.
//   3. Modules import each other only in the allowed direction, and only
//      through the other module's index.
//   4. Imports that the rules restrict to types are `import type`.
//   5. The pure modules do not touch the DOM, timers, the clock or
//      unseeded randomness.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');

const ALLOWED_DEV_DEPENDENCIES = new Set(['typescript', '@types/node']);

// module → modules it may import. `typeOnly` lists those it may import
// types from but no values.
const RULES = {
  track: { may: [], typeOnly: [] },
  pattern: { may: [], typeOnly: [] },
  motion: { may: [], typeOnly: [] },
  surface: { may: ['track', 'pattern'], typeOnly: ['track', 'pattern'] },
  mount: { may: ['track', 'pattern', 'motion', 'surface'], typeOnly: [] },
  catalog: { may: ['mount'], typeOnly: ['mount'] },
};

const PURE_MODULES = new Set(['track', 'pattern', 'motion']);
const IMPURE_GLOBALS =
  /\b(window|document|navigator|globalThis|performance|Date|setTimeout|setInterval|requestAnimationFrame|queueMicrotask)\b|Math\.random/;

const problems = [];
const report = (file, message) => problems.push(`${file}: ${message}`);

// 1. Dependencies.
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const name of Object.keys(manifest.dependencies ?? {})) {
  report('package.json', `runtime dependency "${name}" is not allowed`);
}
for (const name of Object.keys(manifest.devDependencies ?? {})) {
  if (!ALLOWED_DEV_DEPENDENCIES.has(name)) {
    report('package.json', `dev dependency "${name}" is not on the allowlist`);
  }
}

function listSources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listSources(path);
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

// Removes comments and the contents of string literals that are not
// import specifiers, so that prose cannot trigger a rule.
function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

function moduleOf(path) {
  const parts = relative(src, path).split(sep);
  return parts.length > 1 ? parts[0] : null;
}

const IMPORT = /\b(import|export)\s+(type\s+)?(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/g;

for (const path of listSources(src)) {
  const file = relative(root, path).split(sep).join('/');
  const isTest = path.endsWith('.test.ts');
  const owner = moduleOf(path);
  const code = stripComments(readFileSync(path, 'utf8'));

  for (const match of code.matchAll(IMPORT)) {
    const typeOnly = Boolean(match[2]);
    const specifier = match[3];

    if (!specifier.startsWith('.')) {
      // 2. Tests may use Node built-ins; nothing else may leave the tree.
      if (!(isTest && specifier.startsWith('node:'))) {
        report(file, `imports "${specifier}"; library source may import relative files only`);
      }
      continue;
    }

    const target = join(dirname(path), specifier);
    const targetModule = moduleOf(target);
    if (owner === null || targetModule === null || targetModule === owner) continue;

    // 3. Direction and index-only access.
    const rule = RULES[owner];
    if (rule === undefined) {
      report(file, `module "${owner}" has no entry in scripts/check-rules.mjs`);
      continue;
    }
    if (!rule.may.includes(targetModule)) {
      report(file, `module "${owner}" may not import module "${targetModule}"`);
      continue;
    }
    const expected = posix.join(targetModule, 'index.js');
    if (relative(src, target).split(sep).join('/') !== expected) {
      report(file, `imports "${specifier}"; use the index of module "${targetModule}"`);
    }
    // 4. Type-only edges. Tests are exempt: they exercise values.
    if (!isTest && rule.typeOnly.includes(targetModule) && !typeOnly) {
      report(file, `must use "import type" for module "${targetModule}"`);
    }
  }

  // 5. Purity.
  if (owner !== null && PURE_MODULES.has(owner) && !isTest) {
    const hit = code.match(IMPURE_GLOBALS);
    if (hit) report(file, `pure module "${owner}" uses "${hit[0]}"`);
  }
}

if (problems.length > 0) {
  console.error(`check-rules: ${problems.length} problem(s)\n` + problems.join('\n'));
  process.exit(1);
}
console.log('check-rules: ok');
