<script>
// The same reach forward in Svelte's own language.
let ahead = 42;
</script>

{#each [[]] as [one = ahead, ahead]}<i data-k="ahead">{one}</i>{/each}
