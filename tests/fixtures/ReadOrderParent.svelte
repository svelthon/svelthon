<script>
    // ReadOrder's parent, which writes `title` as a call: the child's read of
    // the prop runs it.
    import ReadOrder from './ReadOrder.svelte';
    import { first } from './read_order.js';
</script>

<ReadOrder kind="prop" title={first()} />
