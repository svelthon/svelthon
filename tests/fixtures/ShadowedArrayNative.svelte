<script>
    // The same arrays in Svelte: the witness for ShadowedArray.
    import { shadowed } from './shadowed_arrays.js';

    let { kind = 'null' } = $props();

    const initial = () => shadowed(kind);
    const classesOf = () => shadowed(kind, true);

    let picked = $state.raw(initial());

    const classes = classesOf();
</script>

<select multiple bind:value={picked}><option value={1}>one</option><option value={2}>two</option></select>
<p class={classes}>text</p>
