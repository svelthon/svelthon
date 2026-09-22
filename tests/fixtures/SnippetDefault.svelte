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
