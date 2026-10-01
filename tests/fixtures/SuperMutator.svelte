<script lang="python">
# A container changed through `super()`: the method is looked up on the super
# object, and the container it changes is that object's `__self__`.
class Rows(list):
    def push(self, value):
        super().append(value)

    def push_later(self, value):
        put = super().append
        put(value)

    def set_first(self, value):
        super().__setitem__(0, value)


class Table(dict):
    def merge(self, values):
        super().update(values)


rows = Rows()
table = Table()


def push():
    rows.push(1)


def push_later():
    rows.push_later(2)


def set_first():
    rows.set_first(9)


def merge():
    table.merge({"answer": 42})
</script>

<button data-k="push" onclick={push}>push</button>
<button data-k="push-later" onclick={push_later}>later</button>
<button data-k="set-first" onclick={set_first}>first</button>
<button data-k="merge" onclick={merge}>merge</button>
<p data-k="rows">{rows}</p>
<p data-k="table">{table}</p>
