<script lang="python">
# `chunks` groups a flat list into rows — Jinja's `|batch`, injected rather than
# imported. The third argument pads the last row, which is what a <table> needs.
items = ["a", "b", "c", "d", "e"]


def probe(fn):
    try:
        return str(fn())
    except Exception as e:
        return "{}: {}".format(type(e).__name__, e)


bad = probe(lambda: chunks(items, 0))
fractional = probe(lambda: chunks(items, 1.5))
shape = str(type(chunks(items, 3)[0]).__name__)
lazily = str(chunks((c.upper() for c in items), 2))
</script>

{#each chunks(items, 3) as row, r}
    <p data-k="plain-{r}">{"".join(row)}</p>
{/each}

{#each chunks(items, 3, "·") as row, r}
    <p data-k="filled-{r}">{"".join(row)}</p>
{/each}

<!-- read twice: a list, so the second block sees the same thing -->
{#each chunks(items, 4) as row, r}
    <p data-k="once-{r}">{"".join(row)}</p>
{/each}
{#each chunks(items, 4) as row, r}
    <p data-k="twice-{r}">{"".join(row)}</p>
{/each}

<p data-k="bad">{bad}</p>
<p data-k="fractional">{fractional}</p>
<p data-k="shape">{shape}</p>
<p data-k="lazily">{lazily}</p>
