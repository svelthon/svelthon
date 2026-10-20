<script>
    // The same component in Svelte, `undefined` for `None`: the witness for
    // HeldNone. A child that may be absent is a state, which is how Svelte is
    // asked for a dynamic child.
    import Frame from './HeldFrame.svelte';

    let Selected = $state(Frame);
    let Absent = $state(undefined);
    let rows = [Frame, undefined];

    export function clear() {
        Selected = undefined;
    }
</script>

{#snippet content(Child)}<Child />{/snippet}

<div data-k="cleared"><Selected /></div>
<div data-k="none"><Absent /></div>
<div data-k="rows">{#each rows as Row}<Row />{/each}</div>
<div data-k="snippet">{@render content(undefined)}</div>
<div data-k="declared">{#if true}{@const Local = undefined}<Local />{/if}</div>
