// The markup half of the preprocessor: turning a Svelte template's expressions
// into Python. Pure string work, and deliberately free of any Node import — the
// browser playground compiles components client-side and needs exactly this,
// while the file next door needs `fs` and `path` and cannot be loaded there.


// Find the '}' closing the block that opens at `start`, ignoring braces inside
// string literals.
function closingBrace(source, start) {
    let depth = 0;
    let quote = null;

    for (let i = start; i < source.length; i++) {
        const c = source[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'" || c === '`') quote = c;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) return i;
    }

    return -1;
}

// Only the markup, never a <script> or <style> body — Python is full of braces
// (dict literals, f-strings) and rewriting them would be catastrophic.
export function overMarkup(content, transform) {
    const blocks = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
    let out = '';
    let cut = 0;
    let block;

    while ((block = blocks.exec(content))) {
        out += transform(content.slice(cut, block.index)) + block[0];
        cut = block.index + block[0].length;
    }

    return out + transform(content.slice(cut));
}

// The one directive that genuinely needs the host language.
//
// `bind:value={name}` wants an *assignable reference*, not an expression:
// Svelte compiles it to a getter and a setter, and a call has no setter. Which
// also means the question of language barely arises — a reference is a name,
// and a name is written the same way in both. The gap is `bind:value={obj.field}`,
// a member expression, and so JavaScript's.
//
// Everything else that used to sit here — `use:`, the transition family,
// `class:`, `style:` — takes an ordinary *value*, and now takes a Python one.
// `use:action={opts}` and `transition:fly={opts}` name their function in the
// directive, never in the value, so there was nothing in the way.
const DIRECTIVE = /^bind:/;

// A handler takes a *callable*, and Python's is `lambda`. So its value is
// compiled as Python like everything else, and what the expression yields is
// wrapped for JavaScript: `pyHandler` reads the signature Brython recorded,
// trims the call to the arity the author declared and converts the arguments —
// which is what lets `lambda: choose(pep)` ignore the DOM event it is handed
// while `lambda e: read(e.target.value)` receives it.
const HANDLER = /^(?:on[a-z]|on:)/;

// The wrapper the generated script defines for handlers. Named here and emitted
// there, so the two have to agree — it exists to carry the component's line
// offset, which the markup pass runs too early to know.
const EVENT_WRAPPER = '__event';

// `class:many={…}` is read for truthiness, so it needs Python's — an empty list
// is false here and true in JavaScript, exactly as in `{#if}`.
const CLASS_DIRECTIVE = /^class:/;

// Names a block introduces, which are not module globals and must therefore be
// passed in as arguments.
const BLOCK_NAMES = {
    '#each': /\bas\s+([^()]*?)\s*(?:\(|$)/,
    '#snippet': /\w+\s*\(([^)]*)\)/,
    ':then': /^:then\s+(.+)$/,
    ':catch': /^:catch\s+(.+)$/,
    '@const': /^@const\s+([^=]+)=/
};

const identifiers = (text) => [...text.matchAll(/[A-Za-z_]\w*/g)].map((m) => m[0]);

function declaredBy(inner) {
    const keyword = inner.trimStart().split(/[\s(]/)[0];
    const pattern = BLOCK_NAMES[keyword];
    if (!pattern) return [];

    const found = inner.trim().match(pattern);
    return found ? identifiers(found[1]) : [];
}

// `{#each xs as x, i (key)}`. The iterable is evaluated outside the block, so it
// is compiled before the block's names exist; the key is evaluated inside it.
// Both matter: a Python iterable that is not a list — a dict, a range, the
// result of .items() — has to become an array for Svelte to walk it.
// `for k, v in d.items()` is how Python unpacks, and `as (k, v)` is how it reads
// in a template. Svelte destructures with brackets — and a Python tuple *is* an
// array, so the two mean the same thing once the punctuation is translated.
function pattern(target) {
    const trimmed = target.trim();

    // Only what is explicitly parenthesised. A bare `x, i` is Svelte's item and
    // index, not a tuple — turning that into `[x, i]` would silently destructure
    // every indexed loop in the project.
    if (!trimmed.startsWith('(')) return trimmed;

    let depth = 0;
    let close = -1;

    for (let i = 0; i < trimmed.length && close === -1; i++) {
        if (trimmed[i] === '(') depth++;
        else if (trimmed[i] === ')' && --depth === 0) close = i;
    }

    if (close === -1) return trimmed;

    const inner = trimmed.slice(1, close).replace(/[()]/g, (one) => (one === '(' ? '[' : ']'));
    return `[${inner}]${trimmed.slice(close + 1)}`;
}

function eachBlock(trimmed, declare, call) {
    const split = trimmed.match(/^#each\s+([\s\S]+?)\s+as\s+([\s\S]+)$/);

    // No `as`: nothing is declared, and there is no key to find either.
    if (!split) {
        const alone = trimmed.match(/^#each\s+([\s\S]+)$/);
        declare([]);
        return alone ? `{#each ${call(alone[1], '__seq')}}` : `{${trimmed}}`;
    }

    // A key trails the target, so the part before it has to be non-empty —
    // otherwise `as (statut, combien)` would read as a key with no target.
    const keyed = split[2].match(/^([\s\S]*\S)\s*\(([^()]*)\)\s*$/);
    const target = pattern(keyed ? keyed[1] : split[2]);

    const iterable = call(split[1], '__seq');
    declare(identifiers(target));

    return `{#each ${iterable} as ${target}` + (keyed ? ` (${call(keyed[2], 'repr')})` : '') + '}';
}

export function pythonExpressions(markup, collect) {
    let out = '';
    let index = 0;
    let inTag = false;
    let quote = null;
    let quotedAttribute = null;
    const scopes = [];

    const inScope = () => [...new Set(scopes.flat())];

    const call = (expr, wrapper) => {
        const args = inScope();
        const name = collect(expr.trim(), wrapper, args);

        // follow() on the block's own names: a row of an {#each} is a plain
        // JavaScript value, not a signal, so reading `it.label` registers
        // nothing by itself. This is what subscribes the row's block to the row.
        return `${name}(${args.map((arg) => `follow(${arg})`).join(', ')})`;
    };

    while (index < markup.length) {
        const char = markup[index];

        if (inTag) {
            if (quote) {
                // `class="badge {statut.lower()}"` — an interpolation inside a
                // quoted attribute value. Svelte concatenates it into a string,
                // so it renders like any other text and goes through __text.
                if (char === '{') {
                    const end = closingBrace(markup, index);

                    const named = quotedAttribute || '';

                    if (end !== -1 && !DIRECTIVE.test(named) && !HANDLER.test(named)) {
                        out += `{${call(markup.slice(index + 1, end), '__text')}}`;
                        index = end + 1;
                        continue;
                    }
                }

                if (char === quote) quote = null;
            } else if (char === '"' || char === "'") {
                quote = char;
                quotedAttribute = (out.match(/([^\s=]+)=$/) || [])[1];
            } else if (char === '{') {
                const end = closingBrace(markup, index);
                if (end !== -1) {
                    const attribute = out.match(/([^\s=]+)=$/);
                    const inner = markup.slice(index + 1, end);
                    const trimmed = inner.trim();

                    if (attribute) {
                        // Three cases. A directive that needs the host language
                        // keeps its text. A handler is Python, and what it
                        // yields is made callable from JavaScript. Everything
                        // else — a component prop included — is Python.
                        if (DIRECTIVE.test(attribute[1])) {
                            out += markup.slice(index, end + 1);
                        } else if (HANDLER.test(attribute[1])) {
                            out += `{${EVENT_WRAPPER}(${call(inner, '')})}`;
                        } else if (CLASS_DIRECTIVE.test(attribute[1])) {
                            out += `{${call(inner, '__truthy')}}`;
                        } else {
                            out += `{${call(inner, '')}}`;
                        }
                    } else if (trimmed.startsWith('...')) {
                        // {...attrs} — spreading a Python dict, whose keys are
                        // JavaScript properties. A shallow copy, so that Svelte's
                        // diff against the previous render sees a mutation: this
                        // is what a JavaScript spread does by itself.
                        out += `{...${call(trimmed.slice(3), '__spread')}}`;
                    } else if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
                        // {name}, Svelte's shorthand for name={name}. Expanding
                        // it is what routes the read through the namespace, and
                        // therefore through the accessor.
                        out += `${trimmed}={${call(trimmed, '')}}`;
                    } else {
                        out += markup.slice(index, end + 1);
                    }

                    index = end + 1;
                    continue;
                }
            } else if (char === '>') {
                inTag = false;
            }

            out += char;
            index++;
            continue;
        }

        if (char === '<') {
            // An HTML comment is not a tag. Quotes mean nothing inside one, and
            // an apostrophe — `aujourd'hui` — would otherwise open a string that
            // never closes, silently leaving the whole rest of the template in
            // JavaScript.
            if (markup.startsWith('<!--', index)) {
                const close = markup.indexOf('-->', index);
                const stop = close === -1 ? markup.length : close + 3;

                out += markup.slice(index, stop);
                index = stop;
                continue;
            }

            inTag = true;
            out += char;
            index++;
            continue;
        }

        if (char !== '{') {
            out += char;
            index++;
            continue;
        }

        const end = closingBrace(markup, index);
        if (end === -1) {
            out += char;
            index++;
            continue;
        }

        const inner = markup.slice(index + 1, end);
        const trimmed = inner.trim();

        if (trimmed.startsWith('#')) {
            if (trimmed.startsWith('#if ')) {
                scopes.push([]);
                out += `{#if ${call(trimmed.slice(4), '__truthy')}}`;
            } else if (trimmed.startsWith('#each ')) {
                out += eachBlock(trimmed, (names) => scopes.push(names), call);
            } else if (trimmed.startsWith('#key ')) {
                // Svelte re-creates the block when the value changes, by
                // identity — which no Python value keeps. repr() gives one.
                scopes.push([]);
                out += `{#key ${call(trimmed.slice(5), 'repr')}}`;
            } else {
                scopes.push(declaredBy(trimmed));
                out += markup.slice(index, end + 1);
            }
        } else if (trimmed.startsWith('/')) {
            scopes.pop();
            out += markup.slice(index, end + 1);
        } else if (trimmed.startsWith(':')) {
            // A continuation clause may rebind the block's names.
            const declared = declaredBy(trimmed);
            if (declared.length) scopes[scopes.length - 1] = declared;

            out += /^:else\s+if\s/.test(trimmed)
                ? `{:else if ${call(trimmed.replace(/^:else\s+if\s/, ''), '__truthy')}}`
                : markup.slice(index, end + 1);
        } else if (trimmed.startsWith('@')) {
            const assigned = trimmed.match(/^@const\s+([^=]+)=([\s\S]+)$/);

            if (assigned) {
                // Compiled before the name it declares enters scope: a const may
                // read the block's names and the consts before it, never itself.
                out += `{@const ${assigned[1].trim()} = ${call(assigned[2], '')}}`;
                scopes[scopes.length - 1]?.push(...declaredBy(trimmed));
            } else if (trimmed.startsWith('@html ')) {
                out += `{@html ${call(trimmed.slice(6), '__text')}}`;
            } else {
                // {@render} calls a snippet, which is a JavaScript function, and
                // {@debug} takes names rather than an expression.
                out += markup.slice(index, end + 1);
            }
        } else {
            out += `{${call(inner, '__text')}}`;
        }

        index = end + 1;
    }

    return out;
}

// Names a component imports or declares in its `<script module>`. They live in
// JavaScript, and Python cannot import them — but they are in scope for the
// generated code, so publishing them into the namespace makes them readable
// from Python. That is what lets a Python component reach `page` from
// `$app/state`, or any npm library at all.
const MODULE_SCRIPT = /<script[^>]*\b(?:module|context=["']module["'])[^>]*>([\s\S]*?)<\/script>/i;
const IMPORT = /import\s+([\s\S]*?)\s+from\s+['"]/g;

// Whatever the block declares in its own right — a constant, a helper, a class.
const DECLARED = /^([ \t]*)(?:export\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;

// Only what the module script declares at its *own* level. `^\s*` with the `m`
// flag matches any indentation, so a `const` inside a function body was
// published as a module name and the component referenced something that does
// not exist there — a ReferenceError at render, for a variable the author had
// scoped correctly.
function topLevelIndent(block) {
    const lines = block.split('\n').filter((line) => line.trim());
    if (!lines.length) return '';

    return lines.reduce((least, line) => {
        const indent = line.match(/^[ \t]*/)[0];
        return indent.length < least.length ? indent : least;
    }, lines[0].match(/^[ \t]*/)[0]);
}

export function moduleImports(content) {
    const block = content.match(MODULE_SCRIPT);
    if (!block) return [];

    const names = [];
    let one;

    IMPORT.lastIndex = 0;

    while ((one = IMPORT.exec(block[1]))) {
        const clause = one[1];
        const braced = clause.match(/\{([\s\S]*)\}/);

        // `import Default, { a as b }` — the part before the brace is a default
        // binding, and each entry inside is renamed by its own `as`.
        for (const piece of (braced ? clause.slice(0, braced.index) : clause).split(',')) {
            const bare = piece.replace(/\*\s*as\s+/, '').trim();
            if (/^[A-Za-z_$][\w$]*$/.test(bare)) names.push(bare);
        }

        if (braced) {
            for (const entry of braced[1].split(',')) {
                const local = entry.split(/\s+as\s+/).pop().trim();
                if (/^[A-Za-z_$][\w$]*$/.test(local)) names.push(local);
            }
        }
    }

    const base = topLevelIndent(block[1]);
    let declaration;

    DECLARED.lastIndex = 0;

    while ((declaration = DECLARED.exec(block[1]))) {
        if (declaration[1] === base) names.push(declaration[2]);
    }

    return [...new Set(names)];
}

// The hidden Python functions a template needs, one per distinct expression.
// Appended to the component's own Python, never prepended, so its line numbers
// stay true — which is what keeps error messages and source maps honest.
export function collector(defs) {
    const seen = new Map();

    return (expression, wrapper, args) => {
        const key = `${wrapper}|${args.join(',')}|${expression}`;
        if (seen.has(key)) return seen.get(key);

        const name = `__expr_${defs.length}`;
        seen.set(key, name);
        defs.push(
            `def ${name}(${args.join(', ')}):\n    return ${wrapper ? `${wrapper}(${expression})` : expression}`
        );

        return name;
    };
}

