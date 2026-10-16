<script lang="python">
# A bindable prop the child proposes a value for, a list, a dict or a number,
# which the parent's setter may refuse, normalize or accept.
value: object = bindable()
kind: str = "array"


@export
def change():
    global value
    value = [2] if kind == "array" else {"n": 2} if kind == "object" else 2


@export
def read():
    return value[0] if kind == "array" else value["n"] if kind == "object" else value
</script>

<p data-k="child">{value[0] if kind == "array" else value["n"] if kind == "object" else value}</p>
