<script lang="python">
    boites = [{"l": 10, "h": 10}, {"l": 15, "h": 4}]
    nom = "Ada"

    def elargir():
        boites[0]["l"] = 20
</script>

<!-- `{y => e}` is the derived, and it follows its data. This is Svelte's own
     documentation example, which their `{const area = …}` gets wrong the moment
     the data moves. -->
{#each boites as boite}
    {aire => boite.l * boite.h}
    {etiquette => f"{boite.l} × {boite.h} = {aire}"}

    <p class="etiquette">{etiquette}</p>
{/each}

<!-- `{x = e}` is state, scoped to the block. Nothing writes to this one, so
     Svelte compiles it to a bare binding. -->
{compte = len(boites)}
<p class="compte">{compte}</p>

<!-- And one that is written, through `bind:` — Svelte upgrades it to a real
     signal. The name is the markup's, so the directive is handed over untouched
     rather than compiled into a read/write pair. -->
{brouillon = nom}
<input bind:value={brouillon} />
<p class="brouillon">{brouillon.upper()}</p>

<button onclick={elargir()}>élargir</button>
