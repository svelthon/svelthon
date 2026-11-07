<script>
    // Svelte's witness for HeldTransitions.svelte, `<svelte:component>`
    // written as the dynamic component it is in runes mode.
    import { record } from './held_transitions.js';
    import { flip } from 'svelte/animate';
    import Child from './HeldTransitionChild.svelte';
    import Card from './HeldCard.svelte';

    let tag = $state('p');
    let item = $state('li');
    let disabled = $state(false);
    let attrs = $state({ disabled: false });
    let show = $state(true);
    let rows = $state([1, 2, 3]);
    let Selected = $state(Child);

    export function toggle() {
        show = !show;
    }

    export function turn() {
        rows = [...rows.slice(1), ...rows.slice(0, 1)];
    }
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
    <Selected />
    <Card><Selected /></Card>
    <svelte:element this={'div'} disabled={disabled}><Selected /></svelte:element>
    {@render piece()}
{/if}

<ul>
    {#each rows as row (row)}
        <svelte:element this={item} data-k={`named${row}`} disabled={disabled} animate:flip>{row}</svelte:element>
    {/each}
    {#each rows as row (row)}
        <svelte:element this={item} data-k={`short${row}`} {disabled} animate:flip>{row}</svelte:element>
    {/each}
    {#each rows as row (row)}
        <svelte:element this={item} data-k={`spread${row}`} {...attrs} animate:flip>{row}</svelte:element>
    {/each}
    {#each rows as row (row)}
        <svelte:element this="{item}" data-k={`quoted${row}`} disabled={disabled} animate:flip>{row}</svelte:element>
    {/each}
</ul>
