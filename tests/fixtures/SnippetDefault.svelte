<script lang="python">
# A snippet's parameter may carry a default, and a default is an **expression**:
# Python's, like everything else a template holds.
limite = 3
</script>

{#snippet seul(value=True)}
    <span data-k="seul">{value}</span>
{/snippet}

{#snippet deux(one, value=limite * 2)}
    <span data-k="deux">{one}:{value}</span>
{/snippet}

{#snippet texte(value="a, b")}
    <span data-k="texte">{value}</span>
{/snippet}

{#snippet aucun(value)}
    <span data-k="aucun">{value}</span>
{/snippet}

{@render seul()}
{@render deux("x")}
{@render texte()}
{@render aucun(False)}

<!-- And the default overridden, which must still win. -->
{#snippet donne(value=True)}
    <span data-k="donne">{value}</span>
{/snippet}

{@render donne(False)}

<!-- A default one bracket lower. Svelte destructures a parameter as deep as a
     pattern is written, and every level of it may carry a default.

     Its own limit, measured beside these on the same shapes: a snippet
     parameter destructured *twice into arrays* — `[[value]]` — throws in
     Svelte's own components too, so there is no row for one here. -->
{#snippet liste([value=True])}
    <span data-k="liste">{value}</span>
{/snippet}

{#snippet melange([one, value=limite])}
    <span data-k="melange">{one}:{value}</span>
{/snippet}

{#snippet nomme({value=limite * 2})}
    <span data-k="nomme">{value}</span>
{/snippet}

{#snippet sousnom({sous: {value=True}})}
    <span data-k="sousnom">{value}</span>
{/snippet}

{#snippet motif([value])}
    <span data-k="motif">{value}</span>
{/snippet}

{@render liste([])}
{@render melange([False])}
{@render nomme({})}
{@render sousnom({"sous": {}})}
{@render motif([True])}

<!-- And the same pattern given its value, which must win over the default. -->
{#snippet listedonne([value=True])}
    <span data-k="listedonne">{value}</span>
{/snippet}

{@render listedonne([False])}
