<script lang="python">
# The target of an {#each} destructures, and a destructuring holds expressions.
# `limite` is read from the module by the defaults below, and read again inside
# the block: a default is evaluated where the loop is written, so the name it
# reads is the module's and never the block's.
limite = 5
</script>

<!-- The shapes Svelte itself runs, measured on its own compiler beside these.
     `EachTargetNative.svelte` carries them in Svelte's language. -->
{#each [[]] as [a=limite]}<i data-k="a">{a}:{limite}</i>{/each}
{#each [[]] as [b=limite], i}<i data-k="b">{b}:{i}</i>{/each}
{#each [[[]]] as [[c=limite]]}<i data-k="c">{c}</i>{/each}
{#each [{}] as {d=limite}}<i data-k="d">{d}</i>{/each}
{#each [{"sous": {}}] as {sous: {e=limite}}}<i data-k="e">{e}</i>{/each}
{#each [[1]] as [f=limite]}<i data-k="f">{f}</i>{/each}
{#each [[]] as [g=limite] (1)}<i data-k="g">{g}</i>{/each}

<!-- And what only Python can say. A JavaScript compiler takes `True` for an
     identifier, so a default that stays in JavaScript compiles and dies at
     mount: these have to be rendered, not merely built. -->
{#each [[]] as [h=True]}<i data-k="h">{h}</i>{/each}
{#each [[]] as [j=len([1, 2])]}<i data-k="j">{j}:{len([1, 2, 3])}</i>{/each}

<!-- A tuple target, which is how Python unpacks and what `.items()` hands
     over, and the call inside one: the translation used to replace every
     parenthesis in the target, so the first call written in a default came out
     as `len[1, 2]`. -->
{#each [(1, 2)] as (k1, k2)}<i data-k="k">{k1}:{k2}</i>{/each}
{#each [(1,)] as (m1, m2=len([1, 2]))}<i data-k="m">{m1}:{m2}</i>{/each}
