<script lang="python">
count = 0
items = []
table = {}
tags = set()
nested = {"rows": []}
nothing = None
Alias = None


class Box:
    def __init__(self):
        self.value = 0
        self.rows = []
        self.extra = "là"


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
    # La marque voyage avec l'objet : le compilateur ne voit rien ici, et la
    # mutation propage quand même.
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


@derived
def passthrough():
    # Rend l'objet lui-même : Svelte mémoïse le dérivé sur `===`, donc rien ne
    # propagerait sans que le lecteur s'abonne à l'objet.
    return items


@derived
def computed():
    return len(items)
</script>

<p data-k="count">{count}</p>
<p data-k="items">{items}</p>
<p data-k="table">{table}</p>
<p data-k="tags">{tags}</p>
<p data-k="nested">{nested}</p>
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
