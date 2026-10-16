<script lang="python">
# A Python parent passing its child a value of its own, of the kind a test
# names.
importjs Child from "./PropWriteKindsChild.svelte"

VALUES = {"float": 0.5, "other": 0.75, "int": 1, "str": "a", "astral": "\U0001F600",
          "none": None, "big": 2 ** 60, "true": True}

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
def model():
    return ref.model()
</script>

<Child bind:this={ref} {value} />
