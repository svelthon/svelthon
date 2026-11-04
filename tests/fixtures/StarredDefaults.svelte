<script lang="python">
# A positional pattern with a default and a star, handed rows of JavaScript's:
# an element absent, `undefined` or a hole, takes the default, as it does
# without the star; `null`, and Python's `None`, are values. The witness is
# `StarredDefaultsNative.svelte`.
importjs { makeRow, later } from './starred_defaults.js'

rows = [makeRow("undefined"), makeRow("hole"), makeRow("null"), [None, "tail"], makeRow("value")]
pending = later("undefined")
</script>

{#each rows as [value="fallback", *rest]}<p data-k="each">{tojson([value, rest])}</p>{/each}
{#snippet shown([value="fallback", *rest])}<p data-k="snippet">{tojson([value, rest])}</p>{/snippet}
{#each rows as row}{@render shown(row)}{/each}
{#await pending then [value="fallback", *rest]}<p data-k="then">{tojson([value, rest])}</p>{/await}
