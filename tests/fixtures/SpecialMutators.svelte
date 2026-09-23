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


def by_iadd():
    rows.__iadd__([1])


def by_iadd_detached():
    add = rows.__iadd__
    add([1])


def by_iadd_type():
    list.__iadd__(rows, [1])


def by_imul():
    rows.__imul__(2)


def by_init():
    list.__init__(rows, [2])


def by_init_child():
    list.__init__(rows, Fresh())


class Fresh:
    def __iter__(self):
        yield []


def grow():
    rows[0].append(1)


table = {}


def by_ior():
    table.__ior__({"a": 1})


def by_set_ior():
    marks.__ior__({1})


marks = set()


def shown():
    return str(rows)
</script>

<button data-k="index" onclick={by_index}>index</button>
<button data-k="method" onclick={by_method}>method</button>
<button data-k="detached" onclick={by_detached}>detached</button>
<button data-k="type" onclick={by_type}>type</button>
<button data-k="delete" onclick={by_delete}>delete</button>
<button data-k="iadd" onclick={by_iadd}>iadd</button>
<button data-k="iadd-detached" onclick={by_iadd_detached}>iadd detached</button>
<button data-k="iadd-type" onclick={by_iadd_type}>iadd type</button>
<button data-k="imul" onclick={by_imul}>imul</button>
<button data-k="init" onclick={by_init}>init</button>
<button data-k="init-child" onclick={by_init_child}>init child</button>
<button data-k="grow" onclick={grow}>grow</button>
<button data-k="ior" onclick={by_ior}>ior</button>
<button data-k="set-ior" onclick={by_set_ior}>set ior</button>
<p data-k="rows">{shown()}</p>
<p data-k="table">{table}</p>
<p data-k="marks">{marks}</p>
