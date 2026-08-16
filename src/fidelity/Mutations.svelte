<script lang="python">
count = 0
items = []
size = 0
depth = 0

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

def mutate_only():
    items.append(len(items))

def rebind_list():
    global items
    items = items + [len(items)]

def mutate_and_publish():
    global size
    items.append(len(items))
    size = len(items)

def attribute_only():
    box.value += 1

def attribute_and_publish():
    global depth
    box.value += 1
    depth = box.value
</script>

<p data-k="count">{count}</p>
<p data-k="items">{items}</p>
<p data-k="size">{size}</p>
<p data-k="depth">{depth}</p>

<button data-k="rebind" onclick={rebind}>rebind</button>
<button data-k="augment" onclick={augment}>augment</button>
<button data-k="mutate_only" onclick={mutate_only}>mutate_only</button>
<button data-k="rebind_list" onclick={rebind_list}>rebind_list</button>
<button data-k="mutate_and_publish" onclick={mutate_and_publish}>mutate_and_publish</button>
<button data-k="attribute_only" onclick={attribute_only}>attribute_only</button>
<button data-k="attribute_and_publish" onclick={attribute_and_publish}>attribute_and_publish</button>
