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

// Directives carry a callback or a JavaScript value, never a rendering, so they
// keep the host language: `onclick={increment}`, `bind:value={name}`,
// `use:action={opts}`, the transition family. Every other attribute — including
// a component prop — carries a Python value and is compiled as one.
const DIRECTIVE = /^(?:on[a-z]|(?:on|use|bind|transition|animate|in|out|class|style):)/;

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

                    if (end !== -1 && !DIRECTIVE.test(quotedAttribute || '')) {
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
                        // A directive carries a callback or a JavaScript value;
                        // every other named attribute, component prop included,
                        // carries a Python one.
                        out += DIRECTIVE.test(attribute[1])
                            ? markup.slice(index, end + 1)
                            : `{${call(inner, '')}}`;
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

