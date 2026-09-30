<script lang="python">
# Keys a container by itself: two equal rows, a list mutated, a list replaced by
# an equal one, and a row a field writes into.
todos = [{"label": "todo"}, {"label": "todo"}]
rows = [1]
people = [{"name": "Ada"}]
# A value keyed by its repr() beside the string that spells that repr.
mixed = [0.5, "0.5", (1, 2), "(1, 2)", b"x", "b'x'"]
# Two NaN are not equal, and their repr() is the same.
nans = [float("nan"), float("nan")]


# Two tuples whose members print alike but are not equal, beside two that are
# built apart and equal.
class Box:
    def __init__(self, ident):
        self.ident = ident

    def __repr__(self):
        return "Box"


boxes = [(Box(1),), (Box(2),)]


# Two tuples whose iteration says the same thing and whose members differ:
# equality reads the members.
class Masked(tuple):
    def __iter__(self):
        return iter([0])


masked = [Masked([1]), Masked([2])]
spelled = [("a", frozenset({1, 2})), ("b", frozenset({2, 3}))]


def grow():
    rows.append(2)


def replace():
    global rows
    rows = list(rows)
</script>

<ul data-k="todos">{#each todos as todo (todo)}<li>{todo["label"]}</li>{/each}</ul>
{#key rows}<i data-k="block">{len(rows)}</i>{/key}
{#each people as person (person)}<input data-k="field" bind:value={person["name"]} />{/each}
<ul data-k="nans">{#each nans as value (value)}<li>{value}</li>{/each}</ul>
<ul data-k="boxes">{#each boxes as box (box)}<li>{box[0].ident}</li>{/each}</ul>
<ul data-k="masked">{#each masked as key (key)}<li>{key[0]}</li>{/each}</ul>
<ul data-k="spelled">{#each spelled as pair (pair)}<li>{pair[0]}</li>{/each}</ul>
<ul data-k="mixed">{#each mixed as item (item)}<li>{type(item).__name__}</li>{/each}</ul>
<button data-k="grow"onclick={grow}>grow</button>
<button data-k="replace" onclick={replace}>replace</button>
