// Joins the compiled ES modules under dist/ into one classic script, so
// that a page opened straight from disk or shown in a sandbox can use the
// library without a server. A development aid for the gallery only; it
// understands exactly the import and export forms that tsc emits.

import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

/**
 * @param {string} entry Absolute path of the entry module.
 * @param {string} globalName Name of the global that receives its exports.
 * @returns {string} A script that defines that global.
 */
export function bundle(entry, globalName) {
  const done = new Set();
  const parts = [];
  // Modules are keyed by their path relative to the entry's folder.
  const id = (path) => JSON.stringify(relative(dirname(entry), path));

  function visit(path) {
    if (done.has(path)) return;
    done.add(path);
    const exported = [];
    const dependency = (specifier) => {
      const target = resolve(dirname(path), specifier);
      visit(target);
      return `__modules[${id(target)}]`;
    };
    const names = (list) =>
      list
        .split(',')
        .map((name) => name.trim().split(/\s+as\s+/))
        .filter(([name]) => name);

    const code = readFileSync(path, 'utf8')
      .replace(/^\/\/# sourceMappingURL=.*$/m, '')
      .replace(/^export \{([^}]*)\} from '([^']+)';?$/gm, (_, list, specifier) => {
        const from = dependency(specifier);
        for (const [name, alias = name] of names(list)) exported.push(`${alias}: ${from}.${name}`);
        return '';
      })
      .replace(/^import \{([^}]*)\} from '([^']+)';?$/gm, (_, list, specifier) => {
        const from = dependency(specifier);
        const bindings = names(list).map(([name, alias]) => (alias ? `${name}: ${alias}` : name));
        return `const { ${bindings.join(', ')} } = ${from};`;
      })
      .replace(/^export \{\s*\};?$/gm, '')
      .replace(/^export (function|const|class) (\w+)/gm, (_, kind, name) => {
        exported.push(`${name}: ${name}`);
        return `${kind} ${name}`;
      });

    if (/^\s*(import|export)\b/m.test(code)) {
      throw new Error(`bundle: ${path} uses an import or export form this script does not handle`);
    }
    parts.push(`__modules[${id(path)}] = (function () {\n${code}\nreturn { ${exported.join(', ')} };\n})();`);
  }

  visit(entry);
  return `var ${globalName} = (function () {\nconst __modules = {};\n${parts.join('\n')}\nreturn __modules[${id(entry)}];\n})();`;
}
