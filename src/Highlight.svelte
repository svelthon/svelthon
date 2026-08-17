<script module>
    // No highlighting library. Brython is already loaded and carries CPython's
    // own tokenizer, so the Python is coloured by Python's own rules and cannot
    // drift from the grammar. Markup and the odd JS block get a light regex
    // pass — there, colour is decoration, not a claim about correctness.
    import 'svelthon/runtime';

    const NAME = 1;
    const NUMBER = 2;
    const STRING = 3;
    const FSTRING = [59, 60, 61];
    const COMMENT = 65;
    const OP = 55;
    const SKIP = [0, 68]; // ENDMARKER, ENCODING

    const KEYWORDS = new Set(
        `False None True and as assert async await break class continue def del elif else except
         finally for from global if import in is lambda nonlocal not or pass raise return try while
         with yield`.split(/\s+/)
    );

    // Builtins the demos use, plus the two names SVELTHON injects.
    const BUILTINS = new Set(
        'len range str int float list dict set tuple sorted sum print publish derived'.split(' ')
    );

    const JS_KEYWORDS = new Set(
        'import export from const let var function return new class extends default as await async'.split(
            ' '
        )
    );

    function classifyPython(token, previous) {
        if (token.type === COMMENT) return 'com';
        if (token.type === STRING || FSTRING.includes(token.type)) return 'str';
        if (token.type === NUMBER) return 'num';
        if (token.type === OP) return 'op';

        if (token.type === NAME) {
            if (KEYWORDS.has(token.string)) return 'kw';
            if (previous && previous.string === '@') return 'fn';
            if (previous && previous.string === 'def') return 'fn';
            if (BUILTINS.has(token.string)) return 'bi';
        }

        return null;
    }

    // Tokens carry line/column, not absolute offsets, so the source is sliced
    // between them — every space and newline survives exactly as written.
    function python(code) {
        const starts = [];
        let offset = 0;
        for (const line of code.split('\n')) {
            starts.push(offset);
            offset += line.length + 1;
        }

        const parts = [];
        let cursor = 0;
        let previous = null;

        try {
            for (const token of globalThis.__BRYTHON__.tokenizer(`${code}\n`, '<demo>', 'file')) {
                if (SKIP.includes(token.type)) continue;

                const from = starts[token.lineno - 1] + token.col_offset;
                const to = Math.min(starts[token.end_lineno - 1] + token.end_col_offset, code.length);
                if (from >= code.length) break;

                if (from > cursor) parts.push({ cls: null, text: code.slice(cursor, from) });
                parts.push({ cls: classifyPython(token, previous), text: code.slice(from, to) });

                cursor = to;
                if (token.string.trim()) previous = token;
            }
        } catch {
            return [{ cls: null, text: code }]; // never let colouring break the page
        }

        if (cursor < code.length) parts.push({ cls: null, text: code.slice(cursor) });
        return parts;
    }

    // Ordered alternation: comments, tags, attribute names, strings, then the
    // {…} bindings — the one place where markup reaches into the script.
    const MARKUP =
        /(<!--[\s\S]*?-->)|(<\/?[A-Za-z][\w:-]*|\/?>)|([A-Za-z_:][\w:.-]*)(?==)|("[^"]*"|'[^']*')|(\{[^{}]*\})/g;
    const MARKUP_CLASSES = ['com', 'tag', 'attr', 'str', 'expr'];

    const JS = /(\/\/[^\n]*)|("[^"]*"|'[^']*'|`[^`]*`)|([A-Za-z_$][\w$]*)/g;

    function byRegex(code, regex, classify) {
        const parts = [];
        let cursor = 0;
        let match;

        regex.lastIndex = 0;
        while ((match = regex.exec(code))) {
            if (match.index > cursor) parts.push({ cls: null, text: code.slice(cursor, match.index) });
            parts.push({ cls: classify(match), text: match[0] });
            cursor = match.index + match[0].length;
        }

        if (cursor < code.length) parts.push({ cls: null, text: code.slice(cursor) });
        return parts;
    }

    const markup = (code) =>
        byRegex(code, MARKUP, (m) => MARKUP_CLASSES[m.slice(1).findIndex((g) => g !== undefined)]);

    const js = (code) =>
        byRegex(code, JS, (m) =>
            m[1] ? 'com' : m[2] ? 'str' : JS_KEYWORDS.has(m[3]) ? 'kw' : null
        );

    // A .svelte file is markup with script blocks inside it; each block is
    // coloured by its own language.
    function svelte(code) {
        const blocks = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/g;
        const parts = [];
        let cursor = 0;
        let block;

        while ((block = blocks.exec(code))) {
            parts.push(...markup(code.slice(cursor, block.index)));
            parts.push(...markup(block[1]));
            parts.push(...(/lang=["']python["']/.test(block[1]) ? python(block[2]) : js(block[2])));
            parts.push(...markup(block[3]));
            cursor = block.index + block[0].length;
        }

        parts.push(...markup(code.slice(cursor)));
        return parts;
    }
</script>

<script>
    let { code, file } = $props();

    const parts = $derived(file.endsWith('.py') ? python(code.trim()) : svelte(code.trim()));
</script>

{#each parts as part}{#if part.cls}<span class={part.cls}>{part.text}</span>{:else}{part.text}{/if}{/each}

<style>
    .kw {
        color: var(--c-kw);
    }
    .fn {
        color: var(--c-fn);
    }
    .str {
        color: var(--c-str);
    }
    .num {
        color: var(--c-num);
    }
    .bi {
        color: var(--c-bi);
    }
    .op {
        color: var(--c-op);
    }
    .com {
        color: var(--c-com);
        font-style: italic;
    }
    .tag {
        color: var(--c-tag);
    }
    .attr {
        color: var(--c-attr);
    }

    /* The braces are where markup reaches into Python — the one thing this whole
       project is about, so they carry the accent. */
    .expr {
        color: var(--accent);
    }
</style>
