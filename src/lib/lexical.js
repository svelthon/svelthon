// Python's lexical rule for what is not code: a comment and a string literal,
// read once for every scanner that walks Python text, the markup's and the
// compiler's alike. Free of any import, so the compiler, which is CommonJS, can
// `require` it, and the browser playground can load it.
//
// One rule, so that a grammar learned here is learned everywhere: a `}` inside a
// **comment** or a **triple-quoted** string ends nothing, and neither does the
// quote of an f-string field that reuses its own, which Python takes since 3.12.

// How far to step over a Python comment or string literal starting at `at`, and
// 0 when neither starts there.
//
// `onField(from, to)`, when given, is told where the expression of each field
// of an f-string lies, nested fields of a specification included: the one place
// that knows the three grammars apart is the one that says where the code is.
export function atomic(source, at, onField) {
    const c = source[at];

    if (c === '#') {
        const end = source.indexOf('\n', at);

        return (end === -1 ? source.length : end) - at;
    }

    if (c !== '"' && c !== "'" && c !== '`') return 0;

    // Three of the same character is a delimiter of its own, and inside it a
    // lone quote is text.
    const fence = source.startsWith(c.repeat(3), at) ? c.repeat(3) : c;

    // An f-string is three grammars in one literal, and the scanner has to know
    // which one it is standing in.
    //
    //  - **text**, where `{{` and `}}` are an escaped brace;
    //  - a **field**, `{…}`, which is Python and may since 3.12 reuse the
    //    delimiter of the string holding it — `f"{ "}" }"` is valid;
    //  - a **format specification**, after the field's own `:`, where `#` is an
    //    option and `'` a fill character rather than a comment and a string,
    //    and where a `{…}` is a field again: `f"{3:{2}}"`.
    //
    // A stack rather than counters, because a `{` means different things in
    // each: at the top it opens a field, inside a field it opens a dict or a
    // set, inside a specification it opens a nested field. Counting braces and
    // brackets alone read the `:` of `f"{ {'x': '}'} }"` as a specification's,
    // and the brace inside that string then closed something.
    const formatted = interpolated(source, at);
    const frames = [];
    const inner = () => frames[frames.length - 1];

    for (let i = at + fence.length; i < source.length; i++) {
        const here = formatted ? inner() : undefined;
        const spec = here !== undefined && here.spec;

        // A backslash hides the character after it, so that `"\""` is one string
        // and not two — **except a brace**, which it cannot hide: the escape for
        // a brace is `{{`, and a backslash before one leaves it opening a field:
        // CPython 3.14 answers `\5` for `rf"\{ x }"` with `x = 5`, and the same,
        // with a warning about the escape, without the `r`.
        if (!spec && source[i] === '\\' && !(formatted && '{}'.includes(source[i + 1]))) {
            i++;
            continue;
        }

        if (formatted) {
            if (frames.length === 0 && (source.startsWith('{{', i) || source.startsWith('}}', i))) {
                i++;
                continue;
            }

            if (source[i] === '{') {
                frames.push({ field: frames.length === 0 || spec, spec: false, brackets: 0, start: i + 1 });
                continue;
            }

            if (source[i] === '}' && frames.length > 0) {
                const closed = frames.pop();

                if (closed.field && !closed.spec) onField?.(closed.start, i);
                continue;
            }

            if (here !== undefined && !spec) {
                if ('(['.includes(source[i])) here.brackets++;
                else if (')]'.includes(source[i])) here.brackets--;
                else if (source[i] === ':' && here.field && here.brackets === 0) {
                    here.spec = true;
                    onField?.(here.start, i);
                    continue;
                }

                const nested = atomic(source, i);

                if (nested > 0) {
                    i += nested - 1;
                    continue;
                }
            }

            // Inside a specification nothing but a brace is syntax, and the
            // fence cannot end the string there either.
            if (spec) continue;
        }

        if (frames.length === 0 && source.startsWith(fence, i)) return i + fence.length - at;
    }

    return source.length - at;
}

// Whether the quote at `at` opens an f-string, read from the prefix letters
// before it. Two at most — `rf`, `fr` — and not the tail of a longer name, so
// the `f` of `def"` is not one.
function interpolated(source, at) {
    let i = at - 1;
    let prefix = '';

    while (i >= 0 && prefix.length < 2 && /[fFtTrRbBuU]/.test(source[i])) {
        prefix = source[i] + prefix;
        i--;
    }

    if (i >= 0 && /[A-Za-z0-9_]/.test(source[i])) return false;

    // A t-string (PEP 750) has the fields of an f-string.
    return /[fFtT]/.test(prefix);
}

// `source` with every comment and string literal replaced by what `replace`
// returns for it, the code between them kept as written: the text a scanner
// reads when it wants the code alone.
export function replaceLiterals(source, replace) {
    let out = '';

    for (let i = 0; i < source.length; ) {
        const step = atomic(source, i);

        if (step > 0) {
            out += replace(source.slice(i, i + step));
            i += step;
        } else out += source[i++];
    }

    return out;
}
