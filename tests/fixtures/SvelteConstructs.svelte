<script lang="python">
# The constructs of Svelte 5 a component writes every day, in a Python one.
importjs TitledCard from "./TitledCard.svelte"
importjs { fade } from "svelte/transition"

tag = "article"
items = [{"id": 1, "name": "a"}, {"id": 2, "name": "b"}]
text = "hello"
el = None
keys = 0
shown = True


def on_key(event):
    global keys
    keys += 1


def on_error(error, reset):
    pass
</script>

<svelte:window onkeydown={on_key} />

<svelte:element this={tag} class="dyn">{text}</svelte:element>

<svelte:boundary onerror={on_error}>
    <p class="inside">inside</p>
</svelte:boundary>

{#each items as item, i (item["id"])}
    <span class="row">{i}:{item.name}</span>
{/each}

<TitledCard title="card">
    <em class="child">child</em>
    {#snippet footer(word)}<small class="foot">{word}</small>{/snippet}
</TitledCard>

{#if shown}<b class="faded" transition:fade={{"duration": 0}}>faded</b>{/if}

<textarea class="ta" bind:value={text}></textarea>
<div class="ref" bind:this={el}></div>
<pre class="pre">{"{"}braces{"}"}</pre>
<output class="keys">{keys}</output>
<output class="el">{type(el).__name__}</output>
