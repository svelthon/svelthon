<script lang="python">
# Two boxes of one group, one of which a script takes out of the page while the
# component stays mounted.
picked = []
</script>

<input data-k="a" type="checkbox" bind:group={picked} value="a" />
<input data-k="b" type="checkbox" bind:group={picked} value="b" />
<p>{", ".join(picked)}</p>
