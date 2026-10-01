<script lang="python">
# A walrus a definition evaluates where it is written, in the module: a
# default of a `def`, a decorator, a class's decorator. The name is the
# module's state, and the page follows its mutations.
def identity(value):
    return lambda thing: thing


def keep(value=(defaulted := [])):
    return value


@identity(decorated := [])
def mark():
    return decorated


@identity(classed := [])
class Holder:
    pass


def add():
    defaulted.append(1)
    decorated.append(2)
    classed.append(3)
</script>

<button data-k="add" onclick={add}>add</button>
<p data-k="seen">{defaulted} {decorated} {classed}</p>
