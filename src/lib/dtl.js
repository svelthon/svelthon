// The Django template language, as surface syntax over Svelte's blocks.
//
// Nothing here adds expressive power: every tag translates to the Svelte block
// that already existed, before a single line of Python is compiled. It is the
// last step of "templates are Python" — the expressions became Python in the
// stage before this one, and this makes the punctuation Python too, for the
// Django and Flask developers who have {% %} in their fingers.
//
// The two syntaxes mix freely inside one file. Nothing forces a choice: `{% if %}`
// is a syntax error in Svelte today, and `{{ x }}` is an object literal that
// renders "[object Object]", so translating them unconditionally takes nothing
// away.

const COMMENT_BLOCK = /\{%\s*comment\s*%\}[\s\S]*?\{%\s*endcomment\s*%\}/g;

// `{# ... #}` is Django's one-liner. `{#if x}` is Svelte's block, and the two
// collide on their first two characters — the closing `#}` is what separates
// them, and a Svelte block never has one.
const COMMENT_INLINE = /\{#[^{}]*#\}/g;

const TAG = /\{%\s*([\s\S]*?)\s*%\}/g;
const VARIABLE = /\{\{\s*([\s\S]*?)\s*\}\}/g;

// `for x in xs`, taking the *last* `in`: the iterable may hold a comprehension.
const FOR = /^([\s\S]+?)\s+in\s+([\s\S]+)$/;

// Svelte keys a list; Django never had to, having no DOM to keep. This is the
// one piece of vocabulary the port invents. It reads as what it does, and it
// comes last so the iterable keeps the whole line otherwise.
const KEY = /^([\s\S]*\S)\s+key\s+([\s\S]+)$/;

// `{% with total=x %}` and its older `{% with x as total %}`.
const WITH_AS = /^([\s\S]+)\s+as\s+(\w+)$/;

// A blank line for a blank line: a stripped comment must not move the markup
// under it, or Svelte's own errors would point one line too high.
const blanked = (text) => text.replace(/[^\n]/g, '');

const lineOf = (source, offset) => source.slice(0, offset).split('\n').length;

// A tuple target is a JavaScript destructuring pattern — which works unchanged,
// because a Python tuple *is* an array: `{% for k, v in d.items() %}` becomes
// `{#each ... as [k, v]}`.
function pattern(target) {
    const inner = target
        .trim()
        .replace(/^\(([\s\S]*)\)$/, '$1')
        .replace(/[()]/g, (c) => (c === '(' ? '[' : ']'))
        .trim();

    return inner.includes(',') ? `[${inner}]` : inner;
}

// The text between a `{% for %}` and the `{% endfor %}` that closes it.
function body(source, from) {
    const tags = new RegExp(TAG.source, 'g');
    tags.lastIndex = from;

    let depth = 0;
    let tag;

    while ((tag = tags.exec(source))) {
        const keyword = tag[1].split(/\s/)[0];

        if (keyword === 'for') depth++;
        else if (keyword === 'endfor' && --depth === 0) return source.slice(from, tag.index);
    }

    return source.slice(from);
}

function forTag(rest, offset, source, where) {
    const keyed = rest.match(KEY);
    const parts = (keyed ? keyed[1] : rest).match(FOR);

    if (!parts) throw new Error(`${where}: {% for %} expects "for <target> in <iterable>"`);

    // forloop is DTL's counter, and it costs a per-row object — so it is only
    // built when the loop's own body actually names it.
    const counted = /\bforloop\b/.test(body(source, offset));

    const target = pattern(parts[1]);
    const iterable = parts[2].trim();

    const head =
        `{#each ${iterable} as ${target}` +
        (counted ? ', __i' : '') +
        (keyed ? ` (${keyed[2].trim()})` : '') +
        '}';

    // __forloop is a hidden module-level function; the {@const} carrying it is
    // compiled to Python like any other template expression.
    return counted ? `${head}{@const forloop = __forloop(__i, ${iterable})}` : head;
}

function withTag(rest, where) {
    const older = rest.match(WITH_AS);
    if (older) return `{@const ${older[2]} = ${older[1].trim()}}`;

    // `{% with a=1 b=2 %}`: assignments separated by whitespace, as in Django.
    const consts = rest
        .split(/\s+(?=[A-Za-z_]\w*\s*=)/)
        .map((one) => one.match(/^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/))
        .filter(Boolean)
        .map((m) => `{@const ${m[1]} = ${m[2].trim()}}`);

    if (!consts.length) throw new Error(`${where}: {% with %} expects "name=expression"`);
    return consts.join('');
}

function translate(inner, offset, source) {
    const keyword = inner.split(/\s+/)[0];
    const rest = inner.slice(keyword.length).trim();
    const where = `line ${lineOf(source, offset)}`;

    const expects = () => {
        if (!rest) throw new Error(`${where}: {% ${keyword} %} expects an expression`);
        return rest;
    };

    switch (keyword) {
        case 'if':
            return `{#if ${expects()}}`;
        case 'elif':
            return `{:else if ${expects()}}`;
        case 'else':
            return '{:else}';
        case 'endif':
            return '{/if}';
        case 'for':
            return forTag(rest, offset, source, where);
        case 'empty':
            return '{:else}';
        case 'endfor':
            return '{/each}';
        case 'with':
            return withTag(rest, where);
        case 'endwith':
            return '';
        default:
            // Silence would hand Svelte a `{% load %}` it cannot parse and let it
            // report something unrecognisable. The tags left out are left out on
            // purpose: composition is Svelte's — components and snippets — and
            // filters are Python's, where they are just functions and methods.
            throw new Error(
                `${where}: unknown template tag {% ${keyword} %}. ` +
                    `Svelthon translates if/elif/else/endif, for/empty/endfor, ` +
                    `with/endwith and comment; use components instead of ` +
                    `{% include %} / {% extends %}, and Python instead of filters.`
            );
    }
}

export const HAS_DTL = /\{%|\{\{|\{#[^{}]*#\}/;

export function dtl(markup) {
    if (!HAS_DTL.test(markup)) return markup;

    const stripped = markup.replace(COMMENT_BLOCK, blanked).replace(COMMENT_INLINE, blanked);

    return stripped
        .replace(TAG, (_whole, inner, offset) => translate(inner, offset, stripped))
        .replace(VARIABLE, (_whole, expression) => `{${expression}}`);
}

// Django's loop counter, in Python because that is where the template reads it
// from: `forloop.counter` is attribute access, which a JavaScript object would
// not answer. Appended to a component's own source, and only when its markup
// names it — one object per row is not free.
export const FORLOOP = `class __Forloop:
    def __init__(self, index, total):
        self.counter0 = index
        self.counter = index + 1
        self.revcounter = total - index
        self.revcounter0 = total - index - 1
        self.first = index == 0
        self.last = index == total - 1
        self.length = total

def __forloop(index, sequence):
    try:
        total = len(sequence)
    except TypeError:
        total = -1
    return __Forloop(index, total)`;
