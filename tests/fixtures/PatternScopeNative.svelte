<script>
// The same seven declarations in Svelte's own language, so what a default may
// read is answered by its compiler at run time rather than written out beside
// ours.
let first = 99;
let later = 7;
</script>

{#each [[1]] as [a, b = a]}<i data-k="earlier">{a}:{b}</i>{/each}
{#each [[]] as [c = first]}<i data-k="outer">{c}</i>{/each}
{#each [[1]] as [first, second = first]}<i data-k="shadow">{first}:{second}</i>{/each}
{#each [[]] as [e = later], i}<i data-k="index">{e}:{i}</i>{/each}
{#each [[]] as [f = i], i}<i data-k="reads-index">{f}:{i}</i>{/each}
{#each [[[1]]] as [[m, n = m]]}<i data-k="nested">{m}:{n}</i>{/each}

{#snippet row(j, k = j)}<i data-k="snippet">{j}:{k}</i>{/snippet}
{@render row(1)}
