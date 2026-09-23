<script lang="python">
# Keys a container by itself: two equal rows, a list mutated, a list replaced by
# an equal one, and a row a field writes into.
todos = [{"label": "todo"}, {"label": "todo"}]
rows = [1]
people = [{"name": "Ada"}]


def grow():
    rows.append(2)


def replace():
    global rows
    rows = list(rows)
</script>

<ul data-k="todos">{#each todos as todo (todo)}<li>{todo["label"]}</li>{/each}</ul>
{#key rows}<i data-k="block">{len(rows)}</i>{/key}
{#each people as person (person)}<input data-k="field" bind:value={person["name"]} />{/each}
<button data-k="grow" onclick={grow}>grow</button>
<button data-k="replace" onclick={replace}>replace</button>
