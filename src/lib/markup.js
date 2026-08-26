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

// The ')' closing the '(' that opens at `start`, ignoring parentheses inside
// string literals.
function closingParen(source, start) {
    let depth = 0;
    let quote = null;

    for (let i = start; i < source.length; i++) {
        const c = source[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'") quote = c;
        else if (c === '(') depth++;
        else if (c === ')' && --depth === 0) return i;
    }

    return -1;
}

// Walk `text` at depth zero, ignoring anything inside a string, a bracket or a
// parenthesis. Used to find where an expression ends — a comma between two
// arguments, or the `then` of an await block — without parsing Python.
function atTopLevel(text, visit) {
    let depth = 0;
    let quote = null;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'") quote = c;
        else if (c === '(' || c === '[' || c === '{') depth++;
        else if (c === ')' || c === ']' || c === '}') depth--;
        else if (depth === 0 && visit(i) === true) return i;
    }

    return -1;
}

// `f(a, b)` → ['a', 'b'], with a comma inside a literal or a call left alone.
function arguments_(text) {
    const parts = [];
    let from = 0;

    atTopLevel(text, (i) => {
        if (text[i] !== ',') return false;
        parts.push(text.slice(from, i));
        from = i + 1;
        return false;
    });

    const last = text.slice(from);
    if (last.trim() || parts.length) parts.push(last);

    return parts;
}

const WALRUS = /^\s*([A-Za-z_]\w*)\s*:=\s*/;

// `(name := value)` is the one assignment Python allows inside an expression,
// and therefore the only one a `lambda` can hold — which is exactly what a
// handler needs, since `onclick={() => (open = !open)}` has no Python twin.
//
// Its own meaning is useless here: PEP 572 binds in the enclosing *function*,
// and a lambda is one, so the write dies with the call — silently, which is
// worse than an error. A template is not plain Python either; it already has
// `{#if}`, `{:else}` and four implicit wrappers. So here the walrus writes the
// component's name, through the namespace and therefore through the signal.
//
// Only the parenthesised form, which is the one Python's own grammar forces in
// a lambda. `f(x := 1)` keeps its meaning: a temporary the call consumes.
export function walrus(expression) {
    let out = '';
    let index = 0;
    let quote = null;

    while (index < expression.length) {
        const char = expression[index];

        if (quote) {
            out += char;
            if (char === '\\') out += expression[++index] ?? '';
            else if (char === quote) quote = null;
            index++;
            continue;
        }

        if (char === '"' || char === "'") {
            quote = char;
            out += char;
            index++;
            continue;
        }

        if (char === '(') {
            const found = expression.slice(index + 1).match(WALRUS);
            const close = found ? closingParen(expression, index) : -1;

            if (close !== -1) {
                const value = expression.slice(index + 1 + found[0].length, close);

                out += `__assign("${found[1]}", ${walrus(value)})`;
                index = close + 1;
                continue;
            }
        }

        out += char;
        index++;
    }

    return out;
}

// Only the markup, never a <script> or <style> body — Python is full of braces
// (dict literals, f-strings) and rewriting them would be catastrophic.
//
// `transform` is given where its chunk starts, for a caller that needs to map
// what it finds back onto the original file rather than only rewrite it.
export function overMarkup(content, transform) {
    const blocks = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
    let out = '';
    let cut = 0;
    let block;

    while ((block = blocks.exec(content))) {
        out += transform(content.slice(cut, block.index), cut) + block[0];
        cut = block.index + block[0].length;
    }

    return out + transform(content.slice(cut), cut);
}

// `bind:` needs to read *and* write, which no single expression can do. Svelte
// takes a pair for exactly that — `bind:value={() => v, (n) => v = n}` — so the
// value is compiled twice: once as an expression, once as an assignment target.
// A bare name barely notices, being written the same way in both languages; what
// this buys is `bind:value={row.name}`, a member expression that used to be
// JavaScript's and silently missed a dict.
//
// Everything else that used to sit here — `use:`, the transition family,
// `class:`, `style:` — takes an ordinary *value*, and takes a Python one.
const DIRECTIVE = /^bind:/;

// `bind:group` refuses the pair — Svelte works out which inputs form one group
// from the *text* of the expression, and two anonymous functions have none. So it
// does not become a pair, it becomes an action, and the group stops needing an
// identity at all: each input computes its own `checked` from the same target.
//
// That is also what fixes it. Svelte's own version writes the value with a plain
// JavaScript assignment, which lands on the object but never reaches
// `$B.$setitem` — so nothing re-renders, not even Svelte's effect that unfills
// the others. Going through the pair puts the write back on Python's path.
const GROUP_DIRECTIVE = /^bind:group\b/;

// The shorthand: `bind:value` with no `={…}` is Svelte's way of writing
// `bind:value={value}`. Written that way it never reaches the pair above — the
// scanner looks for an `=` and finds none — so Svelte binds its own `let` for
// the name instead, which is the raw signal cell rather than Python's. Reads
// then miss the namespace and writes never come back, and the first symptom is
// worse than either: `bind:files` with nothing chosen hands Python's `None`
// straight to a DOM property, which fails with `Failed to convert value to
// FileList`.
//
// So the shorthand is expanded before anything else looks at the tag, and the
// long form is the only one the rest of this pass has to know about.
const SHORTHAND = /\bbind:([A-Za-z_$][\w$]*)$/;

// The action the generated script defines for it. Named here and emitted there,
// like `__event`.
const GROUP_ACTION = '__group';

// The setter's parameter. Generated, so it only has to avoid the author's names.
const BOUND_VALUE = '__value';

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

// The key that trails an `{#each}` target: `[target, key]`, or null when the line
// carries none.
//
// A key is an expression, so it holds parentheses of its own — a call, a builtin,
// a tuple. Matching it with `\(([^()]*)\)$` therefore failed on exactly those, and
// failed *silently*: the whole line was taken for the target, so the key travelled
// into the generated markup uncompiled — JavaScript, in a template where nothing
// else is — and the names inside it were declared as the block's own. Measured
// before this existed: `(str(r.id))` reached the browser as `ReferenceError: str
// is not defined`, and a tuple key, which is how Python writes a composite one,
// could not be written at all.
//
// So the group is found by balance rather than by content, ignoring parentheses
// inside a string. Forward, not backwards: only a forward scan can tell an escaped
// quote from a real one.
function trailingKey(text) {
    let depth = 0;
    let quote = null;
    let opens = -1;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];

        if (quote) {
            if (c === '\\') i++;
            else if (c === quote) quote = null;
            continue;
        }

        if (c === '"' || c === "'") quote = c;
        else if (c === '(') {
            if (depth === 0) opens = i;
            depth++;
        } else if (c === ')') {
            // Unbalanced: not something to guess at, and Svelte will report it.
            if (--depth < 0) return null;
            if (depth > 0) continue;

            // Only a group with nothing after it is the key. Anything trailing it
            // means the parentheses belonged to the target instead.
            if (text.slice(i + 1).trim()) continue;

            // And the part before has to be non-empty, or `as (statut, combien)`
            // — a tuple target — would read as a key with no target at all.
            return text.slice(0, opens).trim() ? [text.slice(0, opens), text.slice(opens + 1, i)] : null;
        }
    }

    return null;
}

function eachBlock(trimmed, declare, call) {
    const split = trimmed.match(/^#each\s+([\s\S]+?)\s+as\s+([\s\S]+)$/);

    // No `as`: nothing is declared, and there is no key to find either.
    if (!split) {
        const alone = trimmed.match(/^#each\s+([\s\S]+)$/);
        declare([]);
        return alone ? `{#each ${call(alone[1], '__seq')}}` : `{${trimmed}}`;
    }

    const keyed = trailingKey(split[2]);
    const target = pattern(keyed ? keyed[0] : split[2]);

    const iterable = call(split[1], '__seq');
    declare(identifiers(target));

    return `{#each ${iterable} as ${target}` + (keyed ? ` (${call(keyed[1], 'repr')})` : '') + '}';
}

export function pythonExpressions(markup, collect, onPython) {
    let out = '';
    let index = 0;
    let inTag = false;
    let quote = null;
    let quotedAttribute = null;
    let region = null;
    const scopes = [];

    const inScope = () => [...new Set(scopes.flat())];

    // Where a template expression sits in the *source*, for a caller that needs
    // to point at it rather than compile it — the editor's highlighting above
    // all, which colours these ranges with the same parser as the `<script>`.
    //
    // The range is reported only when the text occurs exactly once inside its
    // own braces, so an ambiguous match — `{#each items as items}` — yields no
    // range rather than the wrong one. A missing highlight is invisible; a
    // misplaced one teaches the reader something false.
    const locate = (expr) => {
        // `{}` has nothing to point at, and a zero-length range is the kind of
        // thing a consumer is entitled not to expect.
        if (!onPython || !region || !expr) return;

        const text = markup.slice(region.start, region.end);
        const at = text.indexOf(expr);

        if (at === -1 || at !== text.lastIndexOf(expr)) return;

        onPython(region.start + at, region.start + at + expr.length);
    };

    // `source` is what the author actually typed, when that differs from what
    // gets compiled — a handler goes through walrus() first, and a range has to
    // point at the text on screen rather than at the rewrite.
    const call = (expr, wrapper, source = expr) => {
        const args = inScope();
        const trimmed = expr.trim();

        locate(source.trim());
        const name = collect(trimmed, wrapper, args);

        // follow() on the block's own names: a row of an {#each} is a plain
        // JavaScript value, not a signal, so reading `it.label` registers
        // nothing by itself. This is what subscribes the row's block to the row.
        return `${name}(${args.map((arg) => `follow(${arg})`).join(', ')})`;
    };

    // The write half of a binding: the same text, compiled as an assignment
    // target rather than as an expression. No locate() — it is the same source
    // text the read half already reported, and a range must not be sent twice.
    const assign = (expr) => {
        const args = inScope();
        const name = collect(expr.trim(), '', args, true);
        const rest = args.map((arg) => `follow(${arg})`);

        return `${name}(${[BOUND_VALUE, ...rest].join(', ')})`;
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
                        region = { start: index + 1, end };
                        out += `{${call(markup.slice(index + 1, end), '__text')}}`;
                        region = null;
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

                    region = { start: index + 1, end };

                    if (attribute) {
                        // A binding becomes a read/write pair; `bind:group` is
                        // the one Svelte will not take a pair for and keeps its
                        // text. A handler is Python, and what it yields is made
                        // callable from JavaScript. Everything else — a
                        // component prop included — is Python.
                        if (GROUP_DIRECTIVE.test(attribute[1])) {
                            // The tag is never inspected: `type` and `value` are
                            // read off the node at run time, which is why this
                            // needs no lookahead over the attributes.
                            out = out.replace(/[^\s=]+=$/, '') +
                                `use:${GROUP_ACTION}={[${call(inner, '')}, (${BOUND_VALUE}) => ${assign(inner)}]}`;
                        } else if (DIRECTIVE.test(attribute[1])) {
                            out += `{() => ${call(inner, '__bound')}, (${BOUND_VALUE}) => ${assign(inner)}}`;
                        } else if (HANDLER.test(attribute[1])) {
                            // A handler is the one place a template expression
                            // is allowed to write: it runs on an event, not
                            // during a render — where Svelte rejects a write to
                            // state, and rightly so.
                            out += `{${EVENT_WRAPPER}(${call(walrus(inner), '', inner)})}`;
                        } else if (CLASS_DIRECTIVE.test(attribute[1])) {
                            out += `{${call(inner, '__truthy')}}`;
                        } else {
                            // `href={website}` with nothing to show: None goes
                            // out as undefined so Svelte drops the attribute
                            // rather than writing the word "None" into it. In a
                            // template the default failure is absence. The same
                            // wrapper the bindings use — the boundary is the
                            // same one, and a prop passed to a child is read
                            // back as None on the other side regardless.
                            out += `{${call(inner, '__bound')}}`;
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

                    region = null;
                    index = end + 1;
                    continue;
                }
            } else if (char === '>') {
                inTag = false;
            }

            // `bind:value` on its own ends here — at a space, a slash or the
            // closing bracket — so this is where the name is complete and the
            // absence of an `=` is certain.
            if (/[\s/>]/.test(char)) {
                const short = out.match(SHORTHAND);
                if (short) {
                    out += `={() => ${call(short[1], '__bound')}, (${BOUND_VALUE}) => ${assign(short[1])}}`;
                }
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

        region = { start: index + 1, end };

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
            } else if (trimmed.startsWith('#await ')) {
                // The awaited expression is Python like any other — a coroutine
                // included, since the wrapper hands one back as a promise. What
                // follows it is a name the block declares, never an expression:
                // `{#await f() then row}`. The split is made at depth zero so
                // that `{#await f("then")}` is not cut inside its own string.
                const rest = trimmed.slice(7);
                const at = atTopLevel(rest, (i) => /^\s(?:then|catch)\s/.test(rest.slice(i)));
                const awaited = at === -1 ? rest : rest.slice(0, at);
                const tail = at === -1 ? '' : rest.slice(at);

                scopes.push(declaredBy(trimmed));
                out += `{#await ${call(awaited, '')}${tail}}`;
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
            } else if (trimmed.startsWith('@render ')) {
                // The snippet itself is a JavaScript function and stays one —
                // what it is *given* is Python. Arguments are split at depth
                // zero, so a comma inside a call or a literal stays put.
                const called = trimmed.slice(8).trim();
                const opens = called.indexOf('(');
                const closes = opens === -1 ? -1 : closingParen(called, opens);

                out += closes === -1
                    ? markup.slice(index, end + 1)
                    : `{@render ${called.slice(0, opens)}(${arguments_(called.slice(opens + 1, closes))
                          .map((one) => (one.trim() ? call(one, '') : one))
                          .join(', ')})${called.slice(closes + 1)}}`;
            } else {
                // {@debug} takes names rather than an expression.
                out += markup.slice(index, end + 1);
            }
        } else {
            out += `{${call(inner, '__text')}}`;
        }

        region = null;
        index = end + 1;
    }

    return out;
}

// The source ranges of every Python expression a template holds — the same
// scan the compiler runs, reporting positions instead of producing code.
//
// It exists for the editor: highlighting the Python inside `{…}` means knowing
// exactly where it is, and that is the hard half. Brace balance, quotes,
// interpolation inside an attribute value, and the difference between `{#if x}`
// — where only `x` is Python — and `{x}` are all already solved above, so this
// borrows the answer rather than guessing at it a second time.
// Takes a whole component, not just its template: it goes through overMarkup
// for the same reason the compiler does, so a dict literal in the `<script>` and
// the braces of a `<style>` are never mistaken for template expressions.
export function pythonRanges(content) {
    const ranges = [];
    let n = 0;

    overMarkup(content, (markup, offset) => {
        pythonExpressions(
            markup,
            () => `__range_${n++}`,
            (from, to) => ranges.push({ from: offset + from, to: offset + to })
        );

        return markup;
    });

    return ranges.sort((a, b) => a.from - b.from);
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

    return (expression, wrapper, args, assign = false) => {
        const key = `${assign ? 'set' : 'get'}|${wrapper}|${args.join(',')}|${expression}`;
        if (seen.has(key)) return seen.get(key);

        // Both kinds keep the `__expr_` prefix: it is what makes the generated
        // wrapper evaluate them the way a template expression is evaluated.
        const name = `__expr_${assign ? 'set_' : ''}${defs.length}`;
        seen.set(key, name);

        if (assign) {
            // A module name assigned inside a function is local unless declared
            // — Python's rule, and the binding would otherwise write into a
            // frame nobody reads. A block's own name is already a parameter.
            const bare = /^[A-Za-z_]\w*$/.test(expression) && !args.includes(expression);

            defs.push(
                [
                    `def ${name}(${[BOUND_VALUE, ...args].join(', ')}):`,
                    ...(bare ? [`    global ${expression}`] : []),
                    `    ${expression} = ${BOUND_VALUE}`
                ].join('\n')
            );
        } else {
            defs.push(
                `def ${name}(${args.join(', ')}):\n    return ${wrapper ? `${wrapper}(${expression})` : expression}`
            );
        }

        return name;
    };
}

