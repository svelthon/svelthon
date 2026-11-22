<script lang="python">
# Names JavaScript's `Object.prototype` spells, which Python's builtins do not
# hold, bound by the module.
constructor = 1
toString = 2


def absent():
    try:
        return valueOf
    except NameError as error:
        return str(error)


@export
def write(value):
    global constructor, toString, valueOf
    constructor = value
    toString = value + 1
    valueOf = value + 2
</script>

<p data-k="view">{constructor}|{toString}|{absent()}</p>
