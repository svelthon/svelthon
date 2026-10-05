<script lang="python">
# What a spread hands a child: the entries `{**value}` reads in Python, for a
# dict, a dict with an int key or a symbol key, a mapping that is not a dict,
# and the rest of a JavaScript row keeping a symbol; what it refuses, a value
# with neither entries nor attributes, and two keys one property name. `kind`
# picks the one spread.
importjs {rows, token} from './rest_symbols.js'
importjs {counted} from './spread_function.js'
importjs SpreadKeysChild from './SpreadKeysChild.svelte'

DATA = {"first": 10, "tail": 20}


class Table:
    def keys(self):
        return list(DATA)

    def __getitem__(self, key):
        return DATA[key]


class Plain:
    def __init__(self):
        self.first = 10


class Slotted:
    __slots__ = ("first",)

    def __init__(self):
        self.first = 10


def marked():
    return 0


marked.mark = 1

kind: str = ""

VALUES = {
    "dict": {"a": 1, "b": 2},
    "int": {1: "one", "b": 2},
    "symbol-dict": {"first": 10, token: 20},
    "mapping": Table(),
    "plain": Plain(),
    "function": marked,
    "js-function": counted,
    "none": None,
    "list": [1],
    "str": "ab",
    "number": 3,
    "bool": True,
    "slots": Slotted(),
    "int-first": {1: "a", "1": "b"},
    "str-first": {"1": "b", 1: "a"},
}
spread = [VALUES[kind]] if kind in VALUES else []
symbol = rows if kind == "symbol" else []
ELEMENTS = {"element": Table(), "element-none": None, "element-str": "ab"}
element = [ELEMENTS[kind]] if kind in ELEMENTS else []
</script>

{#each element as one}
    <i {**one}></i>
{/each}

{#each spread as one}
    <SpreadKeysChild {**one} />
{/each}
{#each symbol as {first: selected, **rest}}
    <SpreadKeysChild {**rest} />
{/each}
