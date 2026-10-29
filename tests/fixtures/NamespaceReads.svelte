<script lang="python">
# Exports of namespaces a proxy stands for, each read once where it is read.
source: object
other: object
</script>

<output data-k="direct">{source.value}</output>
{#each [other] as {value=99}}<output data-k="each">{value}</output>{/each}
