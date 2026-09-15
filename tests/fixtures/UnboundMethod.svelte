<script lang="python">
# Two spellings of one mutation. The second reads `append` off the *type*, so
# the list being changed is an argument rather than the receiver, and the watch
# never saw it: the data grew and the page did not.
xs = []


def on_type():
    list.append(xs, 2)


def on_instance():
    xs.append(1)
</script>

<button data-k="type" onclick={on_type}>list.append(xs, 2)</button>
<button data-k="instance" onclick={on_instance}>xs.append(1)</button>

<p data-k="xs">{xs}</p>
