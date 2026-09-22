<script lang="python">
# A default that reaches a name declared *after* it. Its own file, because the
# answer is an exception at mount and nothing else in a component survives one.
ahead = 42
</script>

{#each [[]] as [one=ahead, ahead]}<i data-k="ahead">{one}</i>{/each}
