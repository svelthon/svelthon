<script lang="python">
# Keys a container by itself: two equal rows, a list mutated, a list replaced by
# an equal one, and a row a field writes into.
todos = [{"label": "todo"}, {"label": "todo"}]
rows = [1]
people = [{"name": "Ada"}]
# A value keyed by its repr() beside the string that spells that repr.
mixed = [0.5, "0.5", (1, 2), "(1, 2)", b"x", "b'x'"]


def grow():
    rows.append(2)


def replace():
    global rows
    rows = list(rows)
</script>

<ul data-k="todos">{#each todos as todo (todo)}<li>{todo["label"]}</li>{/each}</ul>
{#key rows}<i data-k="block">{len(rows)}</i>{/key}
{#each people as person (person)}<input data-k="field" bind:value={person["name"]} />{/each}
<ul data-k="mixed">{#each mixed as item (item)}<li>{type(item).__name__}</li>{/each}</ul>
<button data-k="grow"onclick={grow}>grow</button>
<button data-k="replace" onclick={replace}>replace</button>
