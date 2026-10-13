<script>
// The same seven declarations in Svelte's own language, so what a default may
// read is answered by its compiler at run time rather than written out beside
// ours.
let first = 99;
let later = 7;
let field = 'a';

async function ready() {
    return {};
}

async function broken() {
    throw new Error('no');
}
</script>

{#each [[1]] as [a, b = a]}<i data-k="earlier">{a}:{b}</i>{/each}
{#each [[]] as [c = first]}<i data-k="outer">{c}</i>{/each}
{#each [[1]] as [first, second = first]}<i data-k="shadow">{first}:{second}</i>{/each}
{#each [[]] as [e = later], i}<i data-k="index">{e}:{i}</i>{/each}
{#each [[]] as [f = i], i}<i data-k="reads-index">{f}:{i}</i>{/each}
{#each [[[1]]] as [[m, n = m]]}<i data-k="nested">{m}:{n}</i>{/each}

{#snippet row(j, k = j)}<i data-k="snippet">{j}:{k}</i>{/snippet}
{@render row(1)}

{#each [[{ first: 1 }]] as [{ first }, second = first]}<i data-k="unpacked">{first}:{second}</i>{/each}
{#each [[{ first: 1 }]] as [{ first }, second = first]}<i data-k="unpacked-spelling">{first}:{second}</i>{/each}
{#each [[{ first: 1 }]] as [{ first }, { second } = { second: first }]}<i data-k="unpacked-pattern">{first}:{second}</i>{/each}
{#snippet rowed({ first }, second = first)}<i data-k="snippet-unpacked">{first}:{second}</i>{/snippet}
{@render rowed({ first: 1 })}
{#snippet starred([head, ...rest], count = rest.length)}<i data-k="snippet-starred">{head}:{count}</i>{/snippet}
{@render starred([1, 2, 3])}

{#each [{ A: 42 }] as {[field.toUpperCase()]: got}}<i data-k="key">{got}</i>{/each}

{#snippet keyed({[field.toUpperCase()]: got})}<i data-k="snippet-key">{got}</i>{/snippet}
{@render keyed({ A: 7 })}

{#each [[]] as [label = 'total', total = 0]}<i data-k="literal">{label}:{total}</i>{/each}

{#await ready() then {got = [1, 2].length}}<i data-k="await-short">{got}</i>{/await}
{#await ready()}{:then {got = [1, 2].length}}<i data-k="await-then">{got}</i>{/await}
{#await broken()}{:catch {detail = [1, 2].length}}<i data-k="await-catch">{detail}</i>{/await}
