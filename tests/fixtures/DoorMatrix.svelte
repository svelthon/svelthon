<script lang="python">
# The Python parent of the mounted crossing matrix: a value of the kind a test
# names, handed through the door it names, by name, in a spread, through the
# context or as a snippet's argument, to a child written in Python or in
# JavaScript.
importjs Child from "./DoorMatrixChild.svelte"
importjs ChildNative from "./DoorMatrixChildNative.svelte"
importjs { seen } from "./door_matrix_log.js"

kind: str = "none"
door: str = "name"


class Box:
    def __init__(self, n):
        self.n = n

    def get(self):
        return self.n


class Text(str):
    pass


def identity(x):
    return x


VALUES = {
    "none": None, "true": True, "int": 7, "big": 2 ** 70, "float-int": 15.0, "float": 0.5,
    "str": "a", "astral": "\U0001F600", "str-sub": Text("t"), "bytes": b"ab",
    "list": [1, [2]], "tuple": (1, 2), "dict": {"a": 1, 2: "b"}, "set": {1}, "frozenset": frozenset({1}),
    "instance": Box(1), "function": identity, "method": Box(1).get, "class": Box, "builtin": len,
}

SHOWN = ("NoneType", "bool", "int", "float", "str", "Text", "bytes", "list", "tuple", "dict", "set", "frozenset")


def described(got):
    name = type(got).__name__
    return f"{name}:{got!r}" if name in SHOWN else name


value = VALUES[kind]
given = {"value": value}
seen.append(["parent", described(value)])
set_context("crossing", value)


def told(got):
    seen.append(["python", described(got)])
    return ""
</script>

{#snippet probe(got)}{told(got)}{/snippet}

{#if door == "name" or door == "context"}
    <Child {value} />
{:else if door == "spread"}
    <Child {**given} />
{:else if door == "js-name" or door == "js-context"}
    <ChildNative {value} />
{:else if door == "js-spread"}
    <ChildNative {**given} />
{:else}
    {@render probe(value)}
{/if}
