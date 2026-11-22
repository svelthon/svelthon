<script lang="python">
# The writes a declaration can be mistaken for: a decorator above the marker
# that writes another derived, the two targets of one declaration, and a
# write of the name the declaration makes before its binding, which the
# binding writes over.
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


def given(value):
    return lambda fn: fn


@given((written := 99))
@derived
def written():
    return base * 4


@export
def held():
    return f"{other} {doubled} {first} {second} {written}"


@export
def bump():
    global base
    base += 1
</script>

<p data-k="shown">{other} {doubled} {first} {second} {written}</p>
