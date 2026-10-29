<script lang="python">
# An instance function a parent keeps, whose name the component binds to
# another function, then deletes.
@export
def action():
    return "first"


def replacement():
    return "second"


@export
def rebind():
    global action
    action = replacement


@export
def remove():
    global action
    del action
</script>

<p>api</p>
