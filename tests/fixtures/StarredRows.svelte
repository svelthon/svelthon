<script lang="python">
# The rest of a row by position, `*others`, as Python unpacks a starred target:
# a list, wherever the star stands, on every iterable, at the four places the
# markup declares names. And the rest by key, `**rest`, beside it.
importjs {arrays} from './starred_rows.js'

rows = [[1, 2, 3, 4]]
pairs = [(1, 2, 3)]
words = ["abc"]
dicts = [{"x": 1, "y": 2}]
nested = [[[1, 2], 3, 4]]
awaited = [1, 2, 3]
</script>

{#each rows as [first, *others]}<p data-k="head">{first}|{others}|{type(others).__name__}</p>{/each}
{#each rows as [*others, last]}<p data-k="tail">{others}|{last}</p>{/each}
{#each rows as [first, *others, last]}<p data-k="middle">{first}|{others}|{last}</p>{/each}
{#each rows as [*every]}<p data-k="every">{every}</p>{/each}
{#each pairs as (first, *others)}<p data-k="tuple">{first}|{others}</p>{/each}
{#each words as [first, *others]}<p data-k="str">{first}|{others}</p>{/each}
{#each dicts as [first, *others]}<p data-k="dict">{first}|{others}</p>{/each}
{#each arrays as [first, *others]}<p data-k="array">{first}|{others}|{type(others).__name__}</p>{/each}
{#each nested as [[a, b], *others]}<p data-k="nested">{a}|{b}|{others}</p>{/each}
{#each rows as [first, *[second, *more]]}<p data-k="inner">{first}|{second}|{more}</p>{/each}
{#each rows as [first, *others] (first)}<p data-k="keyed">{first}|{others}</p>{/each}
{#snippet row([first, *others])}<p data-k="snippet">{first}|{others}</p>{/snippet}
{@render row([5, 6, 7])}
{#await awaited then [first, *others]}<p data-k="then">{first}|{others}</p>{/await}
{#each dicts as {x, **rest}}<p data-k="double">{x}|{rest}</p>{/each}
