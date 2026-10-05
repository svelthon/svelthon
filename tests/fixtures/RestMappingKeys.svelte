<script lang="python">
# A mapping's `keys` read as Python reads `row.keys`, its descriptor bound: a
# method, a classmethod, a staticmethod, a property handing back a function, a
# function set on the row. And a field `keys = 3` beside a `__getitem__`, which
# no call can make a mapping of: the row's attributes.
DATA = {"first": 10, "tail": 20}


class Normal:
    def keys(self):
        return list(DATA)

    def __getitem__(self, key):
        return DATA[key]


class ClassKeys:
    @classmethod
    def keys(cls):
        return list(DATA)

    def __getitem__(self, key):
        return DATA[key]


class StaticKeys:
    @staticmethod
    def keys():
        return list(DATA)

    def __getitem__(self, key):
        return DATA[key]


class PropertyKeys:
    @property
    def keys(self):
        return lambda: list(DATA)

    def __getitem__(self, key):
        return DATA[key]


class InstanceKeys:
    def __init__(self):
        self.keys = lambda: list(DATA)

    def __getitem__(self, key):
        return DATA[key]


class FieldKeys:
    def __init__(self):
        self.first = 10
        self.keys = 3

    def __getitem__(self, key):
        return DATA[key]


class Bag(dict):
    pass


class KeyedBag(dict):
    def keys(self):
        return ["first"]


shadowed = Bag(first=10, tail=20)
shadowed.keys = 3

rows = [
    ("dict, keys shadowed", shadowed),
    ("dict, keys redefined", KeyedBag(first=10, tail=20)),
    ("method", Normal()),
    ("classmethod", ClassKeys()),
    ("staticmethod", StaticKeys()),
    ("property", PropertyKeys()),
    ("instance", InstanceKeys()),
    ("field", FieldKeys()),
]
</script>

{#each rows as [kind, row]}
    {#each [row] as {first: selected, **rest}}
        <p data-k={kind}>{selected}|{",".join(sorted(rest))}</p>
    {/each}
{/each}
