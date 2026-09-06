<script lang="python">
seen = 0


def bump(event=None):
    global seen
    seen += 1


# `{onclick}` reads a module-level name, so the handler is bound to one.
onclick = bump
</script>

<button {onclick}>go</button>
<p data-k="seen">{seen}</p>
