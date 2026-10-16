<script lang="python">
# A handler for an event whose name Svelte reads after `on`, in either case:
# `onMyEvent` listens to `MyEvent`, and `onmyevent` to `myevent`.
upper = 0
lower = 0
</script>

<div data-k="upper" onMyEvent={lambda: (upper := upper + 1)}></div>
<div data-k="lower" onmyevent={lambda: (lower := lower + 1)}></div>
<output>{upper} {lower}</output>
