<script lang="python">
# The same mutation, written five ways. Four of them call the special method by
# name; the fifth is the indexed statement Brython compiles to its own entry
# point, and is the witness.
rows = [0]


def by_index():
    rows[0] = 1


def by_method():
    rows.__setitem__(0, 1)


def by_detached():
    write = rows.__setitem__
    write(0, 1)


def by_type():
    list.__setitem__(rows, 0, 1)


def by_delete():
    rows.__delitem__(0)


def shown():
    return str(rows)
</script>

<button data-k="index" onclick={by_index}>index</button>
<button data-k="method" onclick={by_method}>method</button>
<button data-k="detached" onclick={by_detached}>detached</button>
<button data-k="type" onclick={by_type}>type</button>
<button data-k="delete" onclick={by_delete}>delete</button>
<p data-k="rows">{shown()}</p>
