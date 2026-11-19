<script lang="python">
# A child writing its prop with a value of its own, and reading the names of
# its module through `globals()`, which reads a name where it is held.
from prop_classes_shared import Shared

VALUES = {"float2": 2.0, "int2": 2, "int1": 1, "true": True, "half": 0.5, "other": 0.75,
          "shared2": Shared(2, "child-2")}
value: object = "default"


@export
def own(kind):
    global value
    value = VALUES[kind]


@export
def peek():
    for name, held in globals().items():
        pass


@export
def ask():
    return "value" in globals()


def shown(held):
    return f"{type(held).__name__} {held!r} {getattr(held, 'tag', '')}".strip()


@export
def model():
    return shown(value)
</script>

<p>{shown(value)}</p>
