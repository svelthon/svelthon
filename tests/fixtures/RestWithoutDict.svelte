<script lang="python">
# `...rest` of a Python row that is not a mapping is `vars(row)`, which a row
# without a `__dict__` does not have: an instance of a class with `__slots__`,
# a str, an int, None. `kind` picks the row, since each raises.
class Slotted:
    __slots__ = ("first", "tail")

    def __init__(self):
        self.first = 10
        self.tail = 20


class Mixed(Slotted):
    def __init__(self):
        super().__init__()
        self.extra = 30


kind: str = ""

ROWS = {"slots": Slotted(), "mixed": Mixed(), "str": "ab", "int": 3, "none": None}
rows = [ROWS[kind]] if kind in ROWS else []
</script>

{#each rows as {...rest}}
    <p data-k={kind}>{",".join(sorted(rest))}</p>
{/each}
