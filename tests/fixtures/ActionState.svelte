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


class Gauge:
    # The state is read by a property, and held by no field.
    @property
    def amount(self):
        return model.n


class Inherited(Gauge):
    # The property is its base's, whose getters Svelte does not run.
    pass


def counted(base, held):
    # A builtin's subclass of the author's, its property read past its value.
    return [type("Counted", (base,), {"amount": property(lambda self: model.n)})(held)]


rows = [model]
record = {"child": model}
nested = {"child": {"inner": model}}
box = Box(model)
slotted = Slotted(model)
mixed = Mixed(model)
local = [{"n": 1}]
# The instance inside a container, which holds the state in its field.
listbox = [Box(model)]
dictbox = {"child": Box(model)}
tuplebox = (Box(model),)
listslots = [Slotted(model)]
gauged = [Gauge()]
inherited = [Inherited()]
countedlist = counted(list, [1])
counteddict = counted(dict, {"a": 1})
countedset = counted(set, {1})
countedtuple = counted(tuple, (1,))
countedint = counted(int, 1)
countedfloat = counted(float, 1.5)
countedstr = counted(str, "a")
countedbytes = counted(bytes, b"a")
countedbytearray = counted(bytearray, b"a")


def number(kind, value):
    if kind == "direct":
        return value.n
    if kind in ("instance", "slots", "mixed"):
        return value.model.n
    if kind in ("listbox", "tuplebox", "listslots"):
        return value[0].model.n
    if kind == "dictbox":
        return value["child"].model.n
    if kind == "nested":
        return value["child"]["inner"].n
    if kind == "dict":
        return value["child"].n
    if kind == "local":
        return value[0]["n"]
    if kind in ("gauged", "inherited") or kind.startswith("counted"):
        return value[0].amount
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
<div data-k="listbox" use:chosen={listbox}></div>
<div data-k="dictbox" use:chosen={dictbox}></div>
<div data-k="tuplebox" use:chosen={tuplebox}></div>
<div data-k="listslots" use:chosen={listslots}></div>
<div data-k="gauged" use:chosen={gauged}></div>
<div data-k="inherited" use:chosen={inherited}></div>
<div data-k="countedlist" use:chosen={countedlist}></div>
<div data-k="counteddict" use:chosen={counteddict}></div>
<div data-k="countedset" use:chosen={countedset}></div>
<div data-k="countedtuple" use:chosen={countedtuple}></div>
<div data-k="countedint" use:chosen={countedint}></div>
<div data-k="countedfloat" use:chosen={countedfloat}></div>
<div data-k="countedstr" use:chosen={countedstr}></div>
<div data-k="countedbytes" use:chosen={countedbytes}></div>
<div data-k="countedbytearray" use:chosen={countedbytearray}></div>
<p>{model.n}|{rows[0].n}|{record["child"].n}|{nested["child"]["inner"].n}|{box.model.n}|{slotted.model.n}|{mixed.model.n}|{local[0]["n"]}</p>
