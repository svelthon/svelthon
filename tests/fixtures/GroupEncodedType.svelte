<script lang="python">
# Checkboxes of one group whose `type` is written with character references,
# each a checkbox as Svelte reads it, and one written plainly.
picked = ["ok"]
</script>

<input data-k="decimal" type="check&#98;ox" value="ok" bind:group={picked} />
<input data-k="hexadecimal" type="check&#x62;ox" value="ok" bind:group={picked} />
<input data-k="bare" type=check&#98;ox value="ok" bind:group={picked} />
<input data-k="single" type='check&#98;ox' value="ok" bind:group={picked} />
<input data-k="first" type="&#99;heckbox" value="ok" bind:group={picked} />
<input data-k="two" type="&#99;heck&#98;ox" value="ok" bind:group={picked} />
<input data-k="unterminated" type="check&#98ox" value="ok" bind:group={picked} />
<input data-k="plain" type="checkbox" value="ok" bind:group={picked} />
