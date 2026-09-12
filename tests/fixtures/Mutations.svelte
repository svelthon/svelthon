<script lang="python">
count = 0
items = []
table = {}
tags = set()
nested = {"rows": []}
grid = [[]]
nothing = None
Alias = None


class Box:
    def __init__(self):
        self.value = 0
        self.rows = []
        self.extra = "here"


box = Box()
Alias = Box


def rebind():
    global count
    count = count + 1


def augment():
    global count
    count += 10


def rebind_list():
    global items
    items = items + [len(items)]


def mutate_list():
    items.append(len(items))


def mutate_dict():
    table["k"] = len(table)


def drop_key():
    del table["k"]


def mutate_set():
    tags.add(len(tags))


def fill(target):
    target.append("helper")


def through_helper():
    # The mark travels with the object: the compiler sees nothing here, and
    # the mutation propagates anyway.
    fill(items)


def mutate_nested():
    nested["rows"].append(1)


def mutate_via_items():
    for _, rows in nested.items():
        rows.append(2)


def mutate_via_values():
    for rows in nested.values():
        rows.append(3)


def mutate_attribute():
    box.value += 1


def drop_attribute():
    del box.extra


def replace_rows():
    box.rows = []


def add_row():
    box.rows.append(len(box.rows))


# The same mutation, reached by every way Python has of getting hold of the
# method rather than calling it on the spot.
def mutate_detached():
    add = items.append
    add(len(items))


def mutate_mapped():
    list(map(items.append, [len(items)]))


def mutate_fetched():
    getattr(items, "append")(len(items))


# And the ways of getting hold of a child container without indexing it.
def mutate_looped():
    for row in grid:
        row.append(1)


def mutate_comprehended():
    [row.append(2) for row in grid]


def mutate_unpacked():
    one, = grid
    one.append(3)


def mutate_reversed():
    for row in reversed(grid):
        row.append(4)


def mutate_copied():
    list(grid)[0].append(5)


def mutate_augmented():
    row = grid[0]
    row += [7]


def add_row_late():
    grid.append([])


def mutate_late():
    # A row that was not there when `grid` came under watch, and reached
    # through a copy so nothing indexes it on the way.
    list(grid)[-1].append(6)


@derived
def passthrough():
    # Returns the object itself: Svelte memoises a derived on `===`, so
    # nothing would propagate unless the reader subscribes to the object.
    return items


computed => len(items)
</script>

<p data-k="count">{count}</p>
<p data-k="items">{items}</p>
<p data-k="table">{table}</p>
<p data-k="tags">{tags}</p>
<p data-k="nested">{nested}</p>
<p data-k="grid">{grid}</p>
<p data-k="method">{type(items.append).__name__} {repr(items.append)}</p>
<p data-k="attr">{box.value}</p>
<p data-k="extra">{hasattr(box, "extra")}</p>
<p data-k="rows">{box.rows}</p>
<p data-k="nothing">{nothing}</p>
<p data-k="alias">{Alias.__name__}</p>
<p data-k="passthrough">{passthrough}</p>
<p data-k="computed">{computed}</p>

<button data-k="rebind" onclick={rebind}>rebind</button>
<button data-k="augment" onclick={augment}>augment</button>
<button data-k="rebind_list" onclick={rebind_list}>rebind_list</button>
<button data-k="mutate_list" onclick={mutate_list}>mutate_list</button>
<button data-k="mutate_dict" onclick={mutate_dict}>mutate_dict</button>
<button data-k="drop_key" onclick={drop_key}>drop_key</button>
<button data-k="mutate_set" onclick={mutate_set}>mutate_set</button>
<button data-k="through_helper" onclick={through_helper}>through_helper</button>
<button data-k="mutate_nested" onclick={mutate_nested}>mutate_nested</button>
<button data-k="mutate_via_items" onclick={mutate_via_items}>mutate_via_items</button>
<button data-k="mutate_via_values" onclick={mutate_via_values}>mutate_via_values</button>
<button data-k="mutate_attribute" onclick={mutate_attribute}>mutate_attribute</button>
<button data-k="drop_attribute" onclick={drop_attribute}>drop_attribute</button>
<button data-k="replace_rows" onclick={replace_rows}>replace_rows</button>
<button data-k="add_row" onclick={add_row}>add_row</button>
<button data-k="mutate_detached" onclick={mutate_detached}>mutate_detached</button>
<button data-k="mutate_mapped" onclick={mutate_mapped}>mutate_mapped</button>
<button data-k="mutate_fetched" onclick={mutate_fetched}>mutate_fetched</button>
<button data-k="mutate_looped" onclick={mutate_looped}>mutate_looped</button>
<button data-k="mutate_comprehended" onclick={mutate_comprehended}>mutate_comprehended</button>
<button data-k="mutate_unpacked" onclick={mutate_unpacked}>mutate_unpacked</button>
<button data-k="mutate_reversed" onclick={mutate_reversed}>mutate_reversed</button>
<button data-k="mutate_copied" onclick={mutate_copied}>mutate_copied</button>
<button data-k="mutate_augmented" onclick={mutate_augmented}>mutate_augmented</button>
<button data-k="add_row_late" onclick={add_row_late}>add_row_late</button>
<button data-k="mutate_late" onclick={mutate_late}>mutate_late</button>
