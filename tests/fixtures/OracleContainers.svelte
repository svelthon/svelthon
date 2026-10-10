<script lang="python">
# The differential oracle's container matrix. A case is a shape, a holder, a
# write and a read, `"list|module name|append|len"`: `tests/oracle.py` runs
# this same script under CPython, and `tests/oracle-containers.test.js` mounts
# it. A write named `js …` is made by the test on the view `view()` hands
# JavaScript, and what is written here under its name is its Python
# equivalent, which CPython runs.
kind: str

shape, holder, write, how = (kind + "|||").split("|")[:4]

numbers = [1, 2]
table = {"a": 1, "b": 2}
group = {1, 2}


class Box:
    pass


box = Box()
box.numbers = [1, 2]
box.table = {"a": 1, "b": 2}
box.group = {1, 2}


class Shelf:
    numbers = [1, 2]
    table = {"a": 1, "b": 2}
    group = {1, 2}


store = {"numbers": [1, 2], "table": {"a": 1, "b": 2}, "group": {1, 2}}
nest = [[1, 2], {"a": 1, "b": 2}, {1, 2}]
pair = ([1, 2], {"a": 1, "b": 2}, {1, 2})

SHAPES = ["list", "dict", "set"]

HOLDERS = {
    "module name": lambda at: [numbers, table, group][at],
    "instance attribute": lambda at: [box.numbers, box.table, box.group][at],
    "class attribute": lambda at: [Shelf.numbers, Shelf.table, Shelf.group][at],
    "dict value": lambda at: [store["numbers"], store["table"], store["group"]][at],
    "list item": lambda at: nest[at],
    "tuple item": lambda at: pair[at],
}


def assign_item(xs, step):
    xs[0] = step


def delete_item(xs, step):
    del xs[0]


def add_in_place(xs, step):
    xs += [step]


def assign_slice(xs, step):
    xs[:] = [step]


def repeat(xs, step):
    xs *= 2


def fill(xs, step):
    xs[:] = [step] * len(xs)


def kept_method(xs, step):
    add = xs.append
    add(step)


def assign_key(d, step):
    d["k" + str(step)] = step


def overwrite(d, step):
    d["a"] = step


def delete_first(d, step):
    del d[next(iter(d))]


def merge(d, step):
    d |= {"m": step}


def union(s, step):
    s |= {step + 30}


def difference(s, step):
    s -= {step}


WRITES = {
    "list": {
        "append": lambda xs, step: xs.append(step),
        "extend": lambda xs, step: xs.extend([step, step]),
        "insert": lambda xs, step: xs.insert(0, step),
        "item": assign_item,
        "del item": delete_item,
        "+=": add_in_place,
        "slice": assign_slice,
        "*=": repeat,
        "pop": lambda xs, step: xs.pop(),
        "remove": lambda xs, step: xs.remove(xs[0]),
        "sort": lambda xs, step: xs.sort(reverse=True),
        "reverse": lambda xs, step: xs.reverse(),
        "clear": lambda xs, step: xs.clear(),
        "list.append": lambda xs, step: list.append(xs, step),
        "kept method": kept_method,
        "__setitem__": lambda xs, step: xs.__setitem__(0, step),
        "js push": lambda xs, step: xs.append(step),
        "js pop": lambda xs, step: xs.pop(),
        "js shift": lambda xs, step: xs.pop(0),
        "js unshift": lambda xs, step: xs.insert(0, step),
        "js splice out": delete_item,
        "js splice in": lambda xs, step: xs.insert(1, step),
        "js index": assign_item,
        "js length": lambda xs, step: xs.clear(),
        "js reverse": lambda xs, step: xs.reverse(),
        "js fill": fill,
    },
    "dict": {
        "item": assign_key,
        "overwrite": overwrite,
        "del item": delete_first,
        "update": lambda d, step: d.update({"u": step}),
        "pop": lambda d, step: d.pop(next(iter(d))),
        "popitem": lambda d, step: d.popitem(),
        "setdefault": lambda d, step: d.setdefault("s" + str(step), step),
        "clear": lambda d, step: d.clear(),
        "|=": merge,
        "dict.__setitem__": lambda d, step: dict.__setitem__(d, "t", step),
        "js key": assign_key,
        "js overwrite": overwrite,
        "js delete key": delete_first,
        "js assign": lambda d, step: d.update({"u": step}),
    },
    "set": {
        "add": lambda s, step: s.add(step + 10),
        "discard": lambda s, step: s.discard(step),
        "remove": lambda s, step: s.remove(step),
        "update": lambda s, step: s.update({step + 20}),
        "|=": union,
        "-=": difference,
        "clear": lambda s, step: s.clear(),
        "set.add": lambda s, step: set.add(s, step + 40),
        "js add": lambda s, step: s.add(step + 10),
        "js delete": lambda s, step: s.discard(step),
        "js clear": lambda s, step: s.clear(),
    },
}

READS = {
    "list": {
        "len": len,
        "repr": lambda xs: xs,
        "in": lambda xs: 2 in xs,
        "iteration": lambda xs: [x * 2 for x in xs],
    },
    "dict": {
        "len": len,
        "repr": lambda d: d,
        "in": lambda d: "a" in d,
        "get": lambda d: d.get("a"),
    },
    "set": {
        "len": len,
        "sorted": sorted,
        "in": lambda s: 1 in s,
    },
}

CASES = [
    f"{one}|{place}|{written}|{read}"
    for one in SHAPES
    for place in HOLDERS
    for written in WRITES[one]
    for read in READS[one]
]


def target():
    return HOLDERS[holder](SHAPES.index(shape))


def read():
    try:
        return repr(READS[shape][how](target()))
    except Exception as error:
        return type(error).__name__


@export
def model():
    return read()


@export
def view():
    return target()


@export
def change(step):
    WRITES[shape][write](target(), step)
</script>

<output>{read()}</output>
