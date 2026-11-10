<script>
    // A JavaScript child that walks what it is handed, as a chart walks its labels.
    let { value } = $props();
</script>

<p>{Array.isArray(value)} {#each value as one}{String(one)};{/each}</p>
