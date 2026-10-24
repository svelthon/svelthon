<script lang="python">
# The three spellings of a derived, written by Python past their declaration:
# Svelte's write to its derived, held until what the body read changes.
base = 1
arrow => base * 2


@derived
def decorated():
    return base * 3


called = derived(lambda: base * 4)


def shout():
    return "body"


@export
def held():
    return f"{arrow} {decorated} {called}"


@export
def write(value):
    global arrow, decorated, called
    arrow = decorated = called = value


# A function written is a value like any other: the name holds it, uncalled.
@export
def write_function():
    global arrow, decorated, called
    arrow = decorated = called = shout
    return " ".join("held" if one is shout else "called" for one in (arrow, decorated, called))


@export
def bump():
    global base
    base += 1
</script>

<p data-k="shown">{arrow} {decorated} {called}</p>
