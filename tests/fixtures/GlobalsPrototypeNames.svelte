<script lang="python">
# Names JavaScript's `Object.prototype` spells, which Python's builtins do not
# hold, and only `globals()` binds.
globals()["constructor"] = 1
globals()["toString"] = 2


def absent():
    try:
        return valueOf
    except NameError as error:
        return str(error)


@export
def write(value):
    globals()["constructor"] = value
    globals()["toString"] = value + 1
    globals()["valueOf"] = value + 2
</script>

<p data-k="view">{constructor}|{toString}|{absent()}</p>
