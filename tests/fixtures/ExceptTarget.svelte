<script lang="python">
# The name of an `except … as` at the top of the module, unbound when its
# handler ends, as `del` unbinds one: alone, and over a name bound before it.
try:
    raise ValueError("caught")
except ValueError as caught:
    pass

held = "before"
try:
    raise ValueError("held")
except ValueError as held:
    pass


def attempt(read):
    try:
        return str(read())
    except NameError:
        return "NameError"


@export
def reads():
    return [attempt(lambda: caught), attempt(lambda: held), attempt(lambda: later)]


@export
def handle():
    # `global` puts the handler's name in the module, and takes it out again.
    global later
    try:
        raise ValueError("later")
    except ValueError as later:
        seen = str(later)
    return [seen, "later" in globals()]
</script>

<p data-k="caught">[{caught}]</p>
<p data-k="held">[{held}]</p>
<p data-k="later">[{later}]</p>
