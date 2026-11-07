<script>
    // A boundary that records what it is handed, around `Component`.
    import { caught } from './attach_spread.js';

    let { Component, passed } = $props();
</script>

<svelte:boundary onerror={(error) => caught.push(error instanceof Error)}>
    <Component {passed} />
    {#snippet failed()}<p>failed</p>{/snippet}
</svelte:boundary>
