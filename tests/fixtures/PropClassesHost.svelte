<script lang="python">
# A Python parent passing its child a value of its own, of the kind a test names.
importjs Child from "./PropClassesChild.svelte"
from prop_classes_shared import Shared


class Tagged(int):
    def __new__(cls, value, tag):
        self = super().__new__(cls, value)
        self.tag = tag
        return self


VALUES = {"float2": 2.0, "int2": 2, "int1": 1, "true": True, "sub2": Tagged(2, "parent"),
          "half": 0.5, "other": 0.75, "shared1": Shared(1, "parent-1"), "shared2": Shared(2, "parent-2")}
value = "start"
ref = None


@export
def give(kind):
    global value
    value = VALUES[kind]


@export
def own(kind):
    ref.own(kind)


@export
def peek():
    ref.peek()


@export
def ask():
    ref.ask()


@export
def model():
    return ref.model()
</script>

<Child bind:this={ref} {value} />
