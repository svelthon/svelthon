<script>
    // The witness for PythonTruthBindings: the same bindings in Svelte, bound
    // to `false`, `true` or `undefined`.
    let { truth = undefined } = $props();

    const initial = () => truth;

    let checked = $state(initial());
    let indeterminate = $state(initial());
    let opened = $state(initial());
    let muted = $state(initial());
    let paused = $state(initial());

    export function model() {
        return [checked, indeterminate, opened, muted, paused].map((one) => typeof one === 'boolean');
    }
</script>

<input type="checkbox" data-k="checked" bind:checked />
<input type="checkbox" data-k="indeterminate" bind:indeterminate />
<details data-k="open" bind:open={opened}><summary>more</summary></details>
<audio data-k="muted" bind:muted></audio>
<audio data-k="paused" bind:paused></audio>
