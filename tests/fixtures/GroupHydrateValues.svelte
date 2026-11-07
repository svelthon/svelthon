<script lang="python">
# A checkbox group and a radio group whose values the markup evaluates, picked
# on the server. The witness is `GroupHydrateValuesNative.svelte`.
boxes = ["a"]
choice = "a"
</script>

<input data-k="box-a" type="checkbox" value={"a"} bind:group={boxes} />
<input data-k="box-b" type="checkbox" value={"b"} bind:group={boxes} />
{#each ["a", "b"] as one}
    <input data-k={f"radio-{one}"} type="radio" name="choice" value={one} bind:group={choice} />
{/each}
<p data-k="model">{",".join(boxes)}|{choice}</p>
