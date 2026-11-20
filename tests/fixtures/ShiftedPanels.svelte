<script>
    import Short from './ShiftedPanel.svelte';
    import Long from './ShiftedPanel.svelte?layout=long';

    let short = $state();
    let long = $state();

    export const panels = () => ({ short, long });
</script>

<div data-k="short"><Short bind:this={short} /></div>
<div data-k="long"><Long bind:this={long} /></div>
