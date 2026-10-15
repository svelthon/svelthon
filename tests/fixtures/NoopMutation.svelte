<script lang="python">
# A read the template makes that calls a mutator of a set, a dict or a list,
# or of a JavaScript `Set` or `Map`, changing nothing, or something.
importjs { jsSet, jsMap, frameSet, frameMap, crossing } from "./js_collections.js"

kind: str = "set add present"

flags = {1}
empty = set()
labels = {"x": "yes"}
mixed = {1: "yes", "b": 1}
measures = {"x": 2.5}
items = []
held = jsSet(1)
bare = jsSet()
table = jsMap(["x", "yes"])
bare_table = jsMap()
framed = frameSet(1) if kind.startswith("frame") else None
framed_table = frameMap(["x", "yes"]) if kind.startswith("frame") else None
crossed_map, crossed_key = crossing(kind)


# A map Python filled, holding a list, a dict, an instance and a function of
# its own, and keyed by a list too: each crosses as its view or its handler.
class Box:
    pass


def handler():
    return 1


held_row = [1, 2]
held_table = jsMap(["list", held_row], ["dict", {"a": 1}], ["instance", Box()], ["function", handler], [held_row, "keyed"])

# A key whose hash adds a member to its own set once the set is made: 1, which
# the set holds, or 3, which it does not.
added = 3 if kind == "set add nested absent" else 1
enabled = False


class Key:
    def __hash__(self):
        if enabled:
            keyed.add(added)
        return 7


key = Key()
keyed = {1, key}
enabled = True


def read():
    if kind == "set add present":
        flags.add(1)
        return len(flags)
    if kind == "set discard absent":
        flags.discard(2)
        return len(flags)
    if kind == "set clear empty":
        empty.clear()
        return len(empty)
    if kind == "set symmetric empty":
        flags.symmetric_difference_update(set())
        return len(flags)
    if kind == "set symmetric swap":
        flags.symmetric_difference_update({1, 2})
        return len(flags)
    if kind.startswith("set add nested"):
        keyed.add(key)
        return len(keyed)
    if kind == "dict setdefault present":
        return labels.setdefault("x", "no")
    if kind == "dict pop absent":
        return labels.pop("missing", "absent")
    if kind == "dict update empty":
        labels.update({})
        return labels["x"]
    if kind == "dict update same":
        labels.update({"x": labels["x"]})
        return labels["x"]
    if kind == "dict setitem same":
        labels["x"] = labels["x"]
        return labels["x"]
    if kind == "dict update keywords":
        labels.update(x=labels["x"])
        return labels["x"]
    if kind == "dict update pairs":
        labels.update([("x", labels["x"])])
        return labels["x"]
    if kind == "dict mixed update":
        mixed.update({1: mixed[1]})
        return mixed[1]
    if kind == "dict setitem same float":
        before = measures["x"]
        measures["x"] = 2.5
        return "yes" if measures["x"] == before else "no"
    if kind == "dict del absent":
        try:
            del labels["missing"]
        except KeyError:
            pass
        return labels["x"]
    if kind == "dict setitem new value":
        labels["x"] = "no"
        return labels["x"]
    if kind == "set add absent":
        flags.add(2)
        return len(flags)
    if kind == "dict setdefault absent":
        return labels.setdefault("missing", "new")
    if kind == "js set add present":
        held.add(1)
        return held.size
    if kind == "js set delete absent":
        held.delete(2)
        return held.size
    if kind == "js set clear empty":
        bare.clear()
        return bare.size
    if kind == "js map set same":
        table.set("x", table.get("x"))
        return table.get("x")
    if kind == "js map delete absent":
        table.delete("missing")
        return table.size
    if kind == "js map clear empty":
        bare_table.clear()
        return bare_table.size
    if kind == "frame set add present":
        framed.add(1)
        return framed.size
    if kind == "frame set delete absent":
        framed.delete(2)
        return framed.size
    if kind == "frame map set same":
        framed_table.set("x", framed_table.get("x"))
        return framed_table.get("x")
    if kind == "frame set add absent":
        framed.add(2)
        return framed.size
    if kind == "js set add absent":
        held.add(2)
        return held.size
    if kind == "js map set new":
        table.set("x", "no")
        return table.get("x")
    if kind.startswith("js map same "):
        crossed_map.set(crossed_key, crossed_map.get(crossed_key))
        return crossed_map.size
    if kind.startswith("js map new "):
        crossed_map.set(crossed_key, 2.5)
        return crossed_map.size
    if kind.startswith("js map held same "):
        at = held_row if kind.endswith(" key") else kind.split()[-1]
        held_table.set(at, held_table.get(at))
        return held_table.size
    if kind == "js map held new list":
        held_table.set("list", [1, 2])
        return held_table.size
    items.extend([])
    return len(items)
</script>

<output>{read()}</output>
