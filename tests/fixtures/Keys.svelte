<script lang="python">
# Every shape of `{#each}` key that holds a parenthesis of its own. They used to
# travel into the markup uncompiled, because the key was matched with a pattern
# that could not contain one.
rows = [
    {"id": 1, "year": 2024, "month": 5, "code": "AB", "note": "-"},
    {"id": 2, "year": 2024, "month": 6, "code": "CD", "note": "-"},
]

pairs = [(1, "a"), (2, "b")]


def code_of(r):
    return r["code"]


def touch():
    # A field no key reads, so every key stays what it was: the rows must be
    # re-rendered in place rather than recreated.
    rows[0]["note"] = "!"
</script>

<ul data-k="call">
{#each rows as r (code_of(r))}<li data-id={r.id}>{r.code}{r.note}</li>{/each}
</ul>

<ul data-k="builtin">
{#each rows as r (str(r.id))}<li data-id={r.id}>{r.code}{r.note}</li>{/each}
</ul>

<ul data-k="tuple">
{#each rows as r ((r.year, r.month))}<li data-id={r.id}>{r.year}-{r.month}</li>{/each}
</ul>

<ul data-k="method">
{#each rows as r (r.code.lower())}<li data-id={r.id}>{r.code}</li>{/each}
</ul>

<ul data-k="quoted">
{#each rows as r (r.code + ")")}<li data-id={r.id}>{r.code}</li>{/each}
</ul>

<ul data-k="destructured">
{#each pairs as (n, tag) (n)}<li data-id={n}>{tag}</li>{/each}
</ul>

<ul data-k="bare">
{#each pairs as (n, tag)}<li data-id={n}>{tag}</li>{/each}
</ul>

<button data-k="touch" onclick={touch}>touch</button>
