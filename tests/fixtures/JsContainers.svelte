<script lang="python">
# A JavaScript container Python holds, changed by its own methods: a `Set` and a
# `Map` under a module name, a `Set` held by an instance, and one a class of the
# author's keeps behind a method of its own.
kind: str

members = js.Set.new()
pairs = js.Map.new()


class Holder:
    def __init__(self):
        self.members = js.Set.new()


holder = Holder()


class Tags:
    def __init__(self):
        self._members = js.Set.new()

    def tag(self, one):
        self._members.add(one)

    def size(self):
        return self._members.size


tags = Tags()


# A factory that keeps the method before the state receives the container.
def kept_set():
    one = js.Set.new()
    return one, one.add


def kept_map():
    one = js.Map.new()
    return one, one.set


early_members, early_add = kept_set()
early_pairs, early_set = kept_map()

if kind in ("set delete", "set clear"):
    members.add(1)
    members.add(2)
if kind == "map delete":
    pairs.set(1, 1)
    pairs.set(2, 2)


def read():
    if kind == "set method kept before the watch":
        return early_members.size
    if kind == "map method kept before the watch":
        return early_pairs.size
    if kind.startswith("map"):
        return pairs.size
    if kind == "set held by an instance":
        return holder.members.size
    if kind == "set behind a method":
        return tags.size()
    return members.size


@export
def model():
    return str(read())


@export
def change(step):
    if kind == "set add":
        members.add(step)
    elif kind == "set delete":
        members.delete(step)
    elif kind == "set clear":
        if step == 1:
            members.clear()
        else:
            members.add(step)
    elif kind == "map set":
        pairs.set(step, step)
    elif kind == "map delete":
        pairs.delete(step)
    elif kind == "set held by an instance":
        holder.members.add(step)
    elif kind == "kept method":
        add = members.add
        add(step)
    elif kind == "method taken by getattr":
        getattr(members, "add")(step)
    elif kind == "set method kept before the watch":
        early_add(step)
    elif kind == "map method kept before the watch":
        early_set(step, step)
    else:
        tags.tag(step)
</script>

<output>{read()}</output>
