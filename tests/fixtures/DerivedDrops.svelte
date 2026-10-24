<script lang="python">
# The three spellings of a derived, deleted, then written: absent, then holding
# the value for good, with no body left to come back to.
base = 1
arrow => base * 2


@derived
def decorated():
    return base * 3


called = derived(lambda: base * 4)


def seen():
    def read(get):
        try:
            return str(get())
        except NameError:
            return "NameError"

    names = " ".join(str(name in globals()) for name in ("arrow", "decorated", "called"))
    return f"{' '.join(read(get) for get in (lambda: arrow, lambda: decorated, lambda: called))} {names}"


@export
def drop():
    global arrow, decorated, called
    del arrow, decorated, called
    return seen()


@export
def write(value):
    global arrow, decorated, called
    arrow = decorated = called = value
    return seen()


@export
def bump():
    global base
    base += 1
    return seen()
</script>

<p>drops</p>
