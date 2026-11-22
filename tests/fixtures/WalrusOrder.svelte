<script lang="python">
order = []


class Box:
    label = ""


box = Box()
rows = {}


def target():
    order.append("target")
    return box


def holder():
    order.append("holder")
    return rows


def key():
    order.append("key")
    return "k"


def value():
    order.append("value")
    return "v"


@export
def seen():
    out = ",".join(order)
    order.clear()
    return out
</script>

<button data-k="attr" onclick={lambda: (target().label := value())}>attr</button>
<button data-k="item" onclick={lambda: (holder()[key()] := value())}>item</button>
