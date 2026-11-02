<script>
    // A JavaScript parent showing what an exported name of its Python child
    // answers, read through `bind:this`.
    import ExportRebound from './ExportRebound.svelte';

    let child = $state();
    export const handle = () => child;
</script>

<ExportRebound bind:this={child} />
<p data-k="shown">{child?.action?.()}</p>
