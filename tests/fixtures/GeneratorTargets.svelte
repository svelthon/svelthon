<script lang="python">
# Generators the template makes, whose `for` target is a key or an attribute
# of the block's row: resumed once the row is replaced, each reads and writes
# the row the block holds then, as Python's own generator would.
rows = [{"label": "first", "flag": 0}]


class Row:
    def __init__(self, label):
        self.label = label
        self.flag = 0


objects = [Row("first")]
kept = []


def keep(node, callback):
    kept.append(callback)


@export
def replace():
    rows[0] = {"label": "second", "flag": 0}
    objects[0] = Row("second")


@export
def resume(at):
    return kept[at]()
</script>

{#each rows as row}
    <i use:keep={(lambda gen: lambda: next(gen))((row["label"] for row["flag"] in [0, 0]))}></i>
    <i use:keep={(lambda gen: lambda: next(gen))((0 for row["flag"] in [1, 2]))}></i>
    <output data-k="item">{row["label"]}:{row["flag"]}</output>
{/each}
{#each objects as row}
    <i use:keep={(lambda gen: lambda: next(gen))((row.label for row.flag in [0, 0]))}></i>
    <i use:keep={(lambda gen: lambda: next(gen))((0 for row.flag in [1, 2]))}></i>
    <output data-k="attribute">{row.label}:{row.flag}</output>
{/each}
