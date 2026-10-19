<script>
    // EachForeignValue in Svelte: its own {#each} over the same value.
    let { data } = $props();
</script>

<p class="each">{#each data as one}<i>{String(one)}</i>{/each}</p>
