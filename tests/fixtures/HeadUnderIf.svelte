<script lang="python">
# A head whose title and description read the page's derived under an {#if}.
class Word:
    def __init__(self):
        self.nom = "zygote"
        self.decoupage = ["zyg", "ote"]
        self.definition = "une cellule"


word => Word()
</script>

<svelte:head>
    {#if word}
        <title>{word.nom} · Étymobio</title>
        <meta name="description" content="{word.nom}&nbsp;: {' + '.join(word.decoupage)}. {word.definition}" />
    {/if}
</svelte:head>

<p>{word.nom}</p>
