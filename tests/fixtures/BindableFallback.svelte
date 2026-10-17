<script lang="python">
# A bindable prop with a default, which the child clears.
value: object = bindable("default")


@export
def clear():
    global value
    value = None
</script>

<p data-k="child">{value}</p>
