<script>
    // The same component written in Svelte, the witness for `PropAction`.
    import { untrack } from 'svelte';

    let { act, fade, shape = 'scalar' } = $props();

    const make = (step) =>
        shape === 'scalar' ? 0.25 * step : shape === 'record' ? { weight: 0.25 * step } : { run: () => 0.25 * step };

    let value = $state(untrack(() => make(1)));
    let shown = $state(false);

    export function change() {
        value = make(2);
    }

    export function show() {
        shown = true;
    }
</script>

<p use:act={value}>action</p>
{#if shown}<i in:fade={0.25}>shown</i>{/if}
