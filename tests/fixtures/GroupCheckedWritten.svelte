<script lang="python">
# A box and a radio whose `checked` the markup writes, both groups empty: what
# Svelte wrote is the markup's, not a reader's click, so the model stays empty.
boxes = []
choice = ""
</script>

<input data-k="box" type="checkbox" value="yes" checked={True} bind:group={boxes} />
<input data-k="radio" type="radio" value="yes" checked={True} bind:group={choice} />
<p data-k="model">{",".join(boxes)}|{choice}</p>
