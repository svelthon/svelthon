// The markup pass in a browser, as `svelthon/markup` runs there for a page that
// compiles its components itself: the module alone, which loads what it runs
// on, and its answer for a template written into the page. The pass stopped
// loading in a browser once and nothing in the suite saw it, every test running
// it under Node.
import { overMarkup, pythonExpressions, collector } from './lib/markup.js';

const report = document.getElementById('markup');

try {
    const defs = [];
    const out = overMarkup('<p>{len(rows)} {name.upper()}</p>', (part) => pythonExpressions(part, collector(defs)));

    report.textContent = `markup=OK ${out.match(/\{[^}]*\}/g).join(' ')} | ${defs.length} functions`;
} catch (error) {
    report.textContent = `markup=ERR ${error.message}`;
}
