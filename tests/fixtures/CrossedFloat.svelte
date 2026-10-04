<script lang="python">
# A Python child writing floats into a prop its parent binds.
value: object = bindable(0.25)


@export
def half():
    global value
    value = 0.5


@export
def whole():
    global value
    value = 15.0
</script>

<p data-k="child">{type(value).__name__}:{value}</p>
