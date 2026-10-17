<script>
    // The witness for GroupChecked: the same boxes in Svelte.
    let { reverse = false, initial = false } = $props();

    const start = () => initial;

    let picked = $state(start() ? ['a'] : []);
    let checked = $state(start());

    export function model() {
        return [Array.from(picked), checked];
    }

    export function toggle() {
        checked = !checked;
    }
</script>

<form>
    {#if reverse}
        <input data-k="both" type="checkbox" value="a" bind:checked={checked} bind:group={picked} />
    {:else}
        <input data-k="both" type="checkbox" value="a" bind:group={picked} bind:checked />
    {/if}
    <input data-k="other" type="checkbox" value="b" bind:group={picked} />
</form>
