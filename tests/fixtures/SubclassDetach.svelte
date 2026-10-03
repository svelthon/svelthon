<script lang="python">
# One child in a list, a dict or a set, or in a subclass of one, then taken
# out: what reads the container is told about the child while it holds it,
# and not once it has left.
notify: object = None
kind: str = "list"
subclass: bool = False
shape: str = "filled"

missed = []
read = []

class Box:
    def __init__(self):
        self.value = 0

class Rows(list):
    pass

class Table(dict):
    pass

class Bag(set):
    pass

class NamedRows(list):
    def __init__(self, items):
        super().__init__(items)
        self.title = "rows"

class NamedTable(dict):
    def __init__(self, items):
        super().__init__(items)
        self.title = "table"

class NamedBag(set):
    def __init__(self, items):
        super().__init__(items)
        self.title = "bag"

class Lookup(dict):
    def __missing__(self, key):
        missed.append(key)
        return None

class Counted(dict):
    def __getitem__(self, key):
        read.append(key)
        return super().__getitem__(key)

child = Box()

def build(filled):
    if kind == "list":
        cls = (NamedRows if shape == "initialised" else Rows) if subclass else list
        return cls([child] if filled else [])
    if kind == "dict":
        named = {"initialised": NamedTable, "missing": Lookup, "counted": Counted}
        cls = named.get(shape, Table) if subclass else dict
        return cls({"child": child} if filled else {})
    cls = (NamedBag if shape == "initialised" else Bag) if subclass else set
    return cls([child] if filled else [])

rows = build(shape != "appended")

if shape == "kept":
    rows.saved = child

@effect
def observe():
    notify(len(rows))

@export
def add():
    if kind == "list":
        rows.append(child)
    elif kind == "dict":
        rows["child"] = child
    else:
        rows.add(child)

@export
def detach():
    rows.clear()

@export
def mutate():
    child.value += 1

@export
def asked():
    return len(missed) + len(read)
</script>

<p>{child.value}</p>
