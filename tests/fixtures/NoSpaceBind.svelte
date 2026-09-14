<script lang="python">
# The binding face of the same door, kept apart because it is the loud one:
# degraded, `bind:value` becomes a call, and Svelte refuses to bind to anything
# but a name or a member, so the whole component stops compiling.
typed = "start"
</script>

<input data-k="tight_bind" title="y"bind:value={typed}>

<p data-k="typed">{typed}</p>
