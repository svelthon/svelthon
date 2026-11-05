<script lang="python">
# Both coordinates of the window's scroll bound to members of one dict, X
# first; `WindowScrollYX.svelte` binds Y first. The witness is
# `WindowScrollNative.svelte`, and the page that compares them `scroll.html`.
position = {"x": 0, "y": 0}
</script>

<svelte:window bind:scrollX={position["x"]} bind:scrollY={position["y"]} />
<p data-k="model">{position["x"]} {position["y"]}</p>
