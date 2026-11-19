<script lang="python">
value: object = bindable()


@export
def own():
    global value
    value = 2.0


def steps():
    try:
        return str(len(range(value)))
    except TypeError:
        return "TypeError"
</script>

<p>{type(value).__name__}|{repr(value)}|{steps()}</p>
