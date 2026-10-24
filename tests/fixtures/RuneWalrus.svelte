<script lang="python">
# A `:=` of the name inside its own declaration, in a default, a decorator's
# argument, the marker's argument or a comprehension, for a derived as for an
# effect: the declaration's binding writes over it, as Python's does.
notify: object = None
base = 1


def build(value):
    return lambda fn: fn


def body(value):
    return lambda: base * 4


@derived
def by_default(ignored=(by_default := 99)):
    return base * 2


@build(by_decorator := 99)
@derived
def by_decorator():
    return base * 3


by_argument = derived(body(by_argument := 99))

by_comprehension = derived(body([by_comprehension := 1 for _ in [0]]))


@effect
def watched(ignored=(watched := 99)):
    notify(f"watched {base}")


@effect.pre
def early(ignored=(early := 99)):
    notify(f"early {base}")


@export
def held():
    return f"{by_default} {by_decorator} {by_argument} {by_comprehension}"


@export
def bump():
    global base
    base += 1
</script>

<p data-k="shown">{by_default} {by_decorator} {by_argument} {by_comprehension}</p>
