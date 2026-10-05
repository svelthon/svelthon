<script lang="python">
# What a spread hands a child: the entries `{**value}` reads in Python, for a
# dict, a dict with an int key, a mapping that is not a dict, and the rest of a
# JavaScript row keeping a symbol. `kind` picks the one spread.
importjs {rows} from './rest_symbols.js'
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


kind: str = ""

VALUES = {"dict": {"a": 1, "b": 2}, "int": {1: "one", "b": 2}, "mapping": Table(), "plain": Plain()}
spread = [VALUES[kind]] if kind in VALUES else []
symbol = rows if kind == "symbol" else []
element = [Table()] if kind == "element" else []
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
