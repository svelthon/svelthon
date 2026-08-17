<script module>
    // No highlighting library: Brython is already loaded, and it carries
    // CPython's own tokenizer. Colouring Python with Python's tokenizer costs
    // nothing extra here and cannot drift from the grammar.
    import 'svelthon/runtime';

    // Brython's token codes, read off the tokenizer itself.
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

    // Python builtins the demos actually use, plus the two names SVELTHON injects.
    const BUILTINS = new Set(
        'len range str int float list dict set tuple sorted sum print publish derived'.split(' ')
    );

    function classify(token, previous) {
        if (token.type === COMMENT) return 'com';
        if (token.type === STRING || FSTRING.includes(token.type)) return 'str';
        if (token.type === NUMBER) return 'num';
        if (token.type === OP) return 'op';

        if (token.type === NAME) {
            if (KEYWORDS.has(token.string)) return 'kw';
            if (previous && previous.string === '@') return 'dec';
            if (previous && previous.string === 'def') return 'fn';
            if (BUILTINS.has(token.string)) return 'bi';
        }

        return null;
    }

    // Tokens carry line/column, not absolute offsets — so the source is sliced
    // between them, which keeps every space and newline exactly as written.
    function tokenize(code) {
        const starts = [];
        let offset = 0;
        for (const line of code.split('\n')) {
            starts.push(offset);
            offset += line.length + 1;
        }

        const parts = [];
        let cursor = 0;
        let previous = null;

        for (const token of globalThis.__BRYTHON__.tokenizer(`${code}\n`, '<demo>', 'file')) {
            if (SKIP.includes(token.type)) continue;

            const from = starts[token.lineno - 1] + token.col_offset;
            const to = Math.min(starts[token.end_lineno - 1] + token.end_col_offset, code.length);
            if (from >= code.length) break;

            if (from > cursor) parts.push({ cls: null, text: code.slice(cursor, from) });
            parts.push({ cls: classify(token, previous), text: code.slice(from, to) });

            cursor = to;
            if (token.string.trim()) previous = token;
        }

        if (cursor < code.length) parts.push({ cls: null, text: code.slice(cursor) });
        return parts;
    }
</script>

<script>
    let { code } = $props();

    const parts = $derived(tokenize(code));
</script>

{#each parts as part}{#if part.cls}<span class={part.cls}>{part.text}</span>{:else}{part.text}{/if}{/each}

<style>
    .kw {
        color: var(--c-kw);
    }
    .fn {
        color: var(--c-fn);
    }
    .dec {
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
</style>
