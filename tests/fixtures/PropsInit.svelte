<script lang="python">
name: str

greeting = "Hello"
initial = f"{greeting} {name}"   # a prop is readable while the body runs
</script>

<p data-k="initial">{initial}</p>

<!-- A prop the parent never passed renders as nothing, so the question of what
     it *is* has to be asked in Python. `is None` is True for None and False for
     anything else, undefined included. -->
<p data-k="is-none">{name is None}</p>
