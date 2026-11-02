<script lang="python">
# An exported name its own functions bind again, and give back.
@export
def action():
    return "first"


original = action


@export
def change():
    global action
    action = lambda: "second"


@export
def restore():
    global action
    action = original
</script>

<p data-k="own">{action()}</p>
