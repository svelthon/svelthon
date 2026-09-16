<script lang="python">
# A mutation that raises halfway. The generator yields before it fails, so the
# dict keeps what it was given and the operator never returns.
rows = {}


def values():
    yield ("x", 1)
    raise ValueError("interrupted")


def nothing():
    raise ValueError("interrupted")
    yield ("never", 0)


def child():
    yield ("k", [])
    raise ValueError("interrupted")


class Box:
    def __init__(self):
        self.value = 0


def keyed():
    yield (Box(), "label")
    raise ValueError("interrupted")


def partial():
    # A local name for the watched dict: nothing rebinds the module-level one.
    target = rows
    try:
        target |= values()
    except ValueError:
        pass


def early():
    target = rows
    try:
        target |= nothing()
    except ValueError:
        pass


def deep():
    target = rows
    try:
        target |= child()
    except ValueError:
        pass
    target["k"].append(1)


def whole():
    # `rows |= …` written here would assign to a local name and raise
    # UnboundLocalError before reaching the operator at all: the alias is what
    # makes this an in-place mutation of the watched dict.
    target = rows
    target |= [("y", 2)]


def boxed():
    target = rows
    try:
        target |= keyed()
    except ValueError:
        pass


def bump_keys():
    # A *second* handler, deliberately: mutating in the same one as the failed
    # operator would repaint on that operator's own notification and say nothing
    # about whether the key is watched. Through iteration rather than a
    # subscript, because reading a key is not one of the ways the watch is handed
    # over.
    for item in rows:
        item.value += 1


def total():
    return len(rows)


def inner():
    return len(rows.get("k", []))


def scored():
    return sum(item.value for item in rows if isinstance(item, Box))
</script>

<button data-k="partial" onclick={partial}>partial</button>
<button data-k="early" onclick={early}>early</button>
<button data-k="deep" onclick={deep}>deep</button>
<button data-k="whole" onclick={whole}>whole</button>
<button data-k="boxed" onclick={boxed}>boxed</button>
<button data-k="bump-keys" onclick={bump_keys}>bump keys</button>
<p data-k="total">{total()}</p>
<p data-k="inner">{inner()}</p>
<p data-k="scored">{scored()}</p>
