<script lang="python">
# None is what shows the difference: the expanded pair turns it into undefined on
# the way to the DOM, and an unexpanded `bind:` hands Svelte the Python object
# itself, which the field then displays.
value = None
</script>

<!-- One name, bound three times, ending at each of the three characters that can
     finish a shorthand. The fixtures next door only ever wrote the first. -->
<input data-k="space" bind:value >
<input data-k="slash" bind:value/>
<input data-k="close" bind:value>

<!-- With a modifier, which is no part of the name. -->
<input data-k="important" bind:value|important>
