<script lang="python">
# Held tags in every place one stands: at the root, in an element, in a
# component's children, in a snippet, alone in a keyed `{#each}` that
# `animate:` asks for. The witness is `HeldTransitionsNative.svelte`.
importjs { record } from "./held_transitions.js"
importjs { flip } from "svelte/animate"
importjs Child from "./HeldTransitionChild.svelte"
importjs Card from "./HeldCard.svelte"

tag = "p"
item = "li"
disabled = False
attrs = {"disabled": False}
show = True
rows = [1, 2, 3]
Selected = Child


@export
def toggle():
    global show
    show = not show


@export
def turn():
    global rows
    rows = rows[1:] + rows[:1]
</script>

<svelte:element this={tag} data-k="root" disabled={disabled}>root</svelte:element>

{#snippet piece()}
    <svelte:element this={tag} data-k="snippet" disabled={disabled} in:record out:record>snippet</svelte:element>
{/snippet}

{#if show}
    <p data-k="plain" in:record out:record>plain</p>
    <svelte:element this={tag} data-k="block" disabled={disabled} in:record out:record>block</svelte:element>
    <div><svelte:element this={tag} data-k="nested" disabled={disabled} in:record out:record>nested</svelte:element></div>
    <svelte:element this={tag} data-k="closed" disabled={disabled} in:record out:record />
    <Card><svelte:element this={tag} data-k="carded" disabled={disabled} in:record out:record>carded</svelte:element></Card>
    <Selected />
    <svelte:component this={Selected} />
    <Card><Selected /></Card>
    <svelte:element this={"div"} disabled={disabled}><Selected /></svelte:element>
    {@render piece()}
{/if}

<ul>
    {#each rows as row (row)}
        <svelte:element this={item} data-k={f"named{row}"} disabled={disabled} animate:flip>{row}</svelte:element>
    {/each}
    {#each rows as row (row)}
        <svelte:element this={item} data-k={f"short{row}"} {disabled} animate:flip>{row}</svelte:element>
    {/each}
    {#each rows as row (row)}
        <svelte:element this={item} data-k={f"spread{row}"} {**attrs} animate:flip>{row}</svelte:element>
    {/each}
    {#each rows as row (row)}
        <svelte:element this="{item}" data-k={f"quoted{row}"} disabled={disabled} animate:flip>{row}</svelte:element>
    {/each}
</ul>
