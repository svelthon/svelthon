<script lang="python">
# A positional pattern with a default and a star, handed rows of JavaScript's:
# an element absent, `undefined` or a hole, takes the default, as it does
# without the star; `null`, and Python's `None`, are values. And a row too
# short is absent where it ends, as without the star. The witness is
# `StarredDefaultsNative.svelte`.
importjs { makeRow, later, shortRows } from './starred_defaults.js'

rows = [makeRow("undefined"), makeRow("hole"), makeRow("null"), [None, "tail"], makeRow("value")]
pending = later("undefined")
short = shortRows()
</script>

{#each short as [a="d", b="e", *rest]}<p data-k="short">{to_json([a, b, rest])}</p>{/each}

{#each rows as [value="fallback", *rest]}<p data-k="each">{to_json([value, rest])}</p>{/each}
{#snippet shown([value="fallback", *rest])}<p data-k="snippet">{to_json([value, rest])}</p>{/snippet}
{#each rows as row}{@render shown(row)}{/each}
{#await pending then [value="fallback", *rest]}<p data-k="then">{to_json([value, rest])}</p>{/await}
