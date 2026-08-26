<script lang="python">
# `batch` groups a flat list into rows — Jinja's `|batch`, injected rather than
# imported. The third argument pads the last row, which is what a <table> needs.
items = ["a", "b", "c", "d", "e"]


def probe(fn):
    try:
        return str(fn())
    except Exception as e:
        return "{}: {}".format(type(e).__name__, e)


bad = probe(lambda: batch(items, 0))
fractional = probe(lambda: batch(items, 1.5))
shape = str(type(batch(items, 3)[0]).__name__)
lazily = str(batch((c.upper() for c in items), 2))
no_fill = str(batch(items, 3, None))
</script>

{#each batch(items, 3) as row, r}
    <p data-k="plain-{r}">{"".join(row)}</p>
{/each}

{#each batch(items, 3, "·") as row, r}
    <p data-k="filled-{r}">{"".join(row)}</p>
{/each}

<!-- read twice: a list, so the second block sees the same thing -->
{#each batch(items, 4) as row, r}
    <p data-k="once-{r}">{"".join(row)}</p>
{/each}
{#each batch(items, 4) as row, r}
    <p data-k="twice-{r}">{"".join(row)}</p>
{/each}

<p data-k="bad">{bad}</p>
<p data-k="fractional">{fractional}</p>
<p data-k="shape">{shape}</p>
<p data-k="lazily">{lazily}</p>
<p data-k="no-fill">{no_fill}</p>
