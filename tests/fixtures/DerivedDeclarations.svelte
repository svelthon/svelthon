<script lang="python">
# The writes a declaration can be mistaken for: a decorator above the marker
# that writes another derived, the two targets of one declaration, and a
# second statement on the declaration's line.
base = 1
other => base * 10


def decorate(fn):
    global other
    other = 99
    return fn


@decorate
@derived
def doubled():
    return base * 2


first = second = derived(lambda: base * 3)

lined = derived(lambda: base * 4); lined = 40


@export
def held():
    return f"{other} {doubled} {first} {second} {lined}"


@export
def bump():
    global base
    base += 1
</script>

<p data-k="shown">{other} {doubled} {first} {second} {lined}</p>
