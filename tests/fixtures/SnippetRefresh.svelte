<script lang="python">
importjs {source, advance, read} from "./refresh_source.js"

kind: str = "attribute"
count = 0

def change():
    global count
    advance()
    count += 1
</script>

{#snippet card(x)}<button onclick={change}>refresh</button><output>{count + x}</output>{/snippet}

{#if kind == "attribute"}
    {@render card(source.value)}
{:else}
    {@render card(read())}
{/if}
