<script lang="python">
# Descriptors of the author's whose __get__ computes the value read from their
# own state, changed in place: a number, or a list they hold. One declared in
# the script, one made by a factory and changed through the method it hands
# back. What __get__ hands back is the number, or a function, a bound method or
# a callable instance that answers it. One reader rendered, so no other read
# follows the name for it.
by_list: bool = False
reader: str = "instance"
shape: str = "value"


class Result:
    def __init__(self, n):
        self.n = n

    def run(self):
        return self.n

    def __call__(self):
        return self.n


class Field:
    def __init__(self):
        self.n = 0
        self.rows = []

    def __get__(self, obj, owner):
        n = len(self.rows) if by_list else self.n
        if shape == "function":
            return lambda: n
        if shape == "method":
            return Result(n).run
        if shape == "callable":
            return Result(n)
        return n

    def change(self, step):
        if by_list:
            self.rows.append(step)
        else:
            self.n = step


def build():
    field = Field()

    class Model:
        value = field

    class Child(Model):
        def read(self):
            return super().value

    return Child(), field.change


class Row:
    value = Field()


row = Row()
made, mutate = build()


def shown(got):
    return got() if callable(got) else got


@export
def change(step):
    vars(Row)["value"].change(step)
    mutate(step)
</script>

{#if reader == "instance"}
    <output>{shown(row.value)}</output>
{:else if reader == "class"}
    <output>{shown(Row.value)}</output>
{:else if reader == "made"}
    <output>{shown(made.value)}</output>
{:else}
    <output>{shown(made.read())}</output>
{/if}
