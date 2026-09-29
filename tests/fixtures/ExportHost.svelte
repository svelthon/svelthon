<script>
    // A JavaScript parent holding a Python child by `bind:this`.
    import ExportedCounter from './ExportedCounter.svelte';

    let counter = $state();
    export const handle = () => counter;
</script>

<ExportedCounter bind:this={counter} />
