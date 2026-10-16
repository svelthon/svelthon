<script lang="python">
# An action handed a state its parent owns, as it is or inside a Python
# container, and one handed data of Python's own: the parent's action, or this
# one's in Python.
model: object
observe: object
report: object
python_action: bool = False

class Box:
    def __init__(self, model):
        self.model = model


class Slotted:
    __slots__ = ("model",)

    def __init__(self, model):
        self.model = model


class Mixed(Slotted):
    # A `__dict__` of its own, the field still in the slot it inherits.
    pass


rows = [model]
record = {"child": model}
nested = {"child": {"inner": model}}
box = Box(model)
slotted = Slotted(model)
mixed = Mixed(model)
local = [{"n": 1}]


def number(kind, value):
    if kind == "direct":
        return value.n
    if kind in ("instance", "slots", "mixed"):
        return value.model.n
    if kind == "nested":
        return value["child"]["inner"].n
    if kind == "dict":
        return value["child"].n
    if kind == "local":
        return value[0]["n"]
    return value[0].n


def observe_python(node, value):
    kind = node.dataset.k
    report(kind, "install", number(kind, value))

    def update(value):
        report(kind, "update", number(kind, value))

    return {"update": update}


chosen = observe_python if python_action else observe


@export
def bump_local():
    local[0]["n"] += 1
</script>

<div data-k="direct" use:chosen={model}></div>
<div data-k="list" use:chosen={rows}></div>
<div data-k="dict" use:chosen={record}></div>
<div data-k="nested" use:chosen={nested}></div>
<div data-k="instance" use:chosen={box}></div>
<div data-k="slots" use:chosen={slotted}></div>
<div data-k="mixed" use:chosen={mixed}></div>
<div data-k="local" use:chosen={local}></div>
<p>{model.n}|{rows[0].n}|{record["child"].n}|{nested["child"]["inner"].n}|{box.model.n}|{slotted.model.n}|{mixed.model.n}|{local[0]["n"]}</p>
