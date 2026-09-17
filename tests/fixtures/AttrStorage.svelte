<script lang="python">
# The same attribute written four ways. Three of them reach the instance through
# something the runtime intercepts; `vars()` asks the engine for the storage
# directly and writes into it.
class Box:
    def __init__(self):
        self.value = 0
        self.rows = []


box = Box()


def by_attr():
    box.value = 1


def by_dunder():
    box.__dict__["value"] = 1


def by_vars():
    vars(box)["value"] = 1


def by_update():
    vars(box).update({"value": 1})


def by_new_child():
    # A container that arrives through the storage, and is mutated afterwards
    # without ever being read back through the instance.
    vars(box)["later"] = []


def fill_new_child():
    vars(box)["later"].append(1)


def value():
    return box.value


def later():
    # Through `vars` and not `box.__dict__`: reading the dunder hands the watch
    # to the storage, which is the very thing under test — the paragraph would
    # repair the defect it is meant to show.
    return len(vars(box).get("later", []))
</script>

<button data-k="attr" onclick={by_attr}>attr</button>
<button data-k="dunder" onclick={by_dunder}>dunder</button>
<button data-k="vars" onclick={by_vars}>vars</button>
<button data-k="update" onclick={by_update}>update</button>
<button data-k="new-child" onclick={by_new_child}>new child</button>
<button data-k="fill" onclick={fill_new_child}>fill</button>
<p data-k="value">{value()}</p>
<p data-k="later">{later()}</p>
