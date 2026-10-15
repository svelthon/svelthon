<script lang="python">
# A write the template makes, which Svelte refuses, to each kind of object a
# refusal puts back: a dict, a dict's subclass, an instance, a list's and a
# set's subclass, a function and a class, each holding `n`.
kind: str = "dict"


class Table(dict):
    pass


class Box:
    pass


class Rows(list):
    pass


class Bag(set):
    pass


def handler():
    return 1


keyed = kind in ("dict", "dict subclass")
if kind == "dict":
    one = {"n": 0}
elif kind == "dict subclass":
    one = Table(n=0)
else:
    one = {"instance": Box(), "list subclass": Rows(), "set subclass": Bag(), "function": handler, "class": Box}[kind]
    one.n = 0

# Its type and the type of its attributes before any write, which no write
# changes.
types = [type(one), None if keyed else type(vars(one))]


def held():
    return one["n"] if keyed else one.n


def attempt():
    try:
        if keyed:
            one["n"] = 1
        else:
            one.n = 1
    except Exception as error:
        return "refused" if "state_unsafe_mutation" in str(error) else str(error)
    return "written"


@export
def model():
    return [held(), type(one) is types[0] and (keyed or type(vars(one)) is types[1])]
</script>

<p>{held()}</p>
<output>{attempt()}</output>
