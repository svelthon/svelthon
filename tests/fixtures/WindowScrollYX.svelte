<script lang="python">
# `WindowScrollXY.svelte` with Y bound first.
position = {"x": 0, "y": 0}
</script>

<svelte:window bind:scrollY={position["y"]} bind:scrollX={position["x"]} />
<p data-k="model">{position["x"]} {position["y"]}</p>
