<script lang="python">
count = 0
items = []
table = {}
tags = set()
nested = {"rows": []}


class Box:
    def __init__(self):
        self.value = 0


box = Box()


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


def mutate_attribute():
    box.value += 1
</script>

<p data-k="count">{count}</p>
<p data-k="items">{items}</p>
<p data-k="table">{table}</p>
<p data-k="tags">{tags}</p>
<p data-k="nested">{nested}</p>
<p data-k="attr">{box.value}</p>

<button data-k="rebind" onclick={rebind}>rebind</button>
<button data-k="augment" onclick={augment}>augment</button>
<button data-k="rebind_list" onclick={rebind_list}>rebind_list</button>
<button data-k="mutate_list" onclick={mutate_list}>mutate_list</button>
<button data-k="mutate_dict" onclick={mutate_dict}>mutate_dict</button>
<button data-k="drop_key" onclick={drop_key}>drop_key</button>
<button data-k="mutate_set" onclick={mutate_set}>mutate_set</button>
<button data-k="through_helper" onclick={through_helper}>through_helper</button>
<button data-k="mutate_nested" onclick={mutate_nested}>mutate_nested</button>
<button data-k="mutate_attribute" onclick={mutate_attribute}>mutate_attribute</button>
