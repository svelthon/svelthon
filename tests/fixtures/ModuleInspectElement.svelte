<svelte:options customElement={{ tag: 'module-inspect-element', shadow: 'none' }} />

<script module>
    // A function of the author's, named like a marker of Svelthon's.
    const inspect = (value) => value;
</script>

<script lang="python">
    amount: int = inspect(1)
</script>

<output>{amount}</output>
