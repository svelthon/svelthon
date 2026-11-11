<script>
    // A JavaScript child that walks what it is handed, or the member of it
    // `member` names, as a chart walks its labels.
    let { value, member } = $props();
    const walked = $derived(member === undefined ? value : value[member]);
</script>

<p>{Array.isArray(walked)} {#each walked as one}{String(one)};{/each}</p>
