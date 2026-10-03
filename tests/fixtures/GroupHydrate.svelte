<script lang="python">
# A checkbox group and a radio group, both empty on the server: what the reader
# picks before the script runs is kept once the page hydrates.
boxes = []
choice = ""
</script>

<input data-k="box" type="checkbox" value="yes" bind:group={boxes} />
<input data-k="radio" type="radio" value="yes" bind:group={choice} />
<p data-k="model">{",".join(boxes)}|{choice}</p>
