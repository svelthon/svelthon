<script lang="python">
class Item:
    def __init__(self, id, label):
        self.id = id
        self.label = label

items = [Item(1, "a"), Item(2, "b")]
next_id = 3

def prepend():
    global next_id
    items.insert(0, Item(next_id, "c"))
    next_id += 1

def relabel():
    for it in items:
        if it.id == 2:
            it.label = it.label.upper()

def replace():
    for i, it in enumerate(items):
        if it.id == 2:
            items[i] = Item(it.id, it.label.upper())

def drop_first():
    del items[0]
</script>

<ul data-k="list">
{#each items as it (it.id)}<li data-id={it.id}>{it.label}</li>{/each}
</ul>

<ul data-k="pairs">
{#each enumerate(items) as (rank, it)}<li>{rank}:{it.label}</li>{/each}
</ul>
<button data-k="prepend" onclick={prepend}>prepend</button>
<button data-k="relabel" onclick={relabel}>relabel</button>
<button data-k="replace" onclick={replace}>replace</button>
<button data-k="drop_first" onclick={drop_first}>drop_first</button>
