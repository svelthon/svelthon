<script>
// The same seven targets in Svelte's own language, so what a target may hold is
// read off its compiler at run time rather than written out beside ours.
const limite = 5;
</script>

{#each [[]] as [a = limite]}<i data-k="a">{a}:{limite}</i>{/each}
{#each [[]] as [b = limite], i}<i data-k="b">{b}:{i}</i>{/each}
{#each [[[]]] as [[c = limite]]}<i data-k="c">{c}</i>{/each}
{#each [{}] as { d = limite }}<i data-k="d">{d}</i>{/each}
{#each [{ sous: {} }] as { sous: { e = limite } }}<i data-k="e">{e}</i>{/each}
{#each [[1]] as [f = limite]}<i data-k="f">{f}</i>{/each}
{#each [[]] as [g = limite] (1)}<i data-k="g">{g}</i>{/each}
