<script>
    // A Svelte child of the mounted crossing matrix: what it received as a
    // prop, and through the context, read once.
    import { getContext } from 'svelte';
    import { seen } from './door_matrix_log.js';

    let { value = 'absent' } = $props();
    const read = () => value;

    seen.push(['js', read()], ['js-context', getContext('crossing')]);
</script>
