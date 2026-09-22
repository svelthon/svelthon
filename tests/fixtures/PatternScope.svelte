<script lang="python">
# A default in a destructuring reads the names beside it, not only the ones the
# module holds. `first` is here so a target that binds its own `first` can be
# seen to mask it.
first = 99
later = 7
field = "a"
</script>

{#each [[1]] as [a, b=a]}<i data-k="earlier">{a}:{b}</i>{/each}
{#each [[]] as [c=first]}<i data-k="outer">{c}</i>{/each}
{#each [[1]] as [first, second=first]}<i data-k="shadow">{first}:{second}</i>{/each}
{#each [[]] as [e=later], i}<i data-k="index">{e}:{i}</i>{/each}
{#each [[]] as [f=i], i}<i data-k="reads-index">{f}:{i}</i>{/each}
{#each [[[1]]] as [[m, n=m]]}<i data-k="nested">{m}:{n}</i>{/each}

{#snippet row(j, k=j)}<i data-k="snippet">{j}:{k}</i>{/snippet}
{@render row(1)}

<!-- The other place a pattern holds an expression: a computed key. Its names
     are read, never bound, so `field` stays the module's. -->
{#each [{"A": 42}] as {[field.upper()]: got}}<i data-k="key">{got}</i>{/each}

{#snippet keyed({[field.upper()]: got})}<i data-k="snippet-key">{got}</i>{/snippet}
{@render keyed({"A": 7})}

<!-- And a default that is a plain string holding a sibling's name: text, not a
     reference, and reading it as one made the component unmountable. -->
{#each [[]] as [label="total", total=0]}<i data-k="literal">{label}:{total}</i>{/each}
