<script lang="python">
label: str = "rows"
count = 0


@export
def state():
    return 42


def props():
    return count + 1
</script>

<p>{label} {state()} {props()}</p>
