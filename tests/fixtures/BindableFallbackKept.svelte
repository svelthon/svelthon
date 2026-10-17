<script lang="python">
# Defaults whose JavaScript form is not the value Python wrote: a float that
# crosses as an integer, and a list that crosses as its view.
DEFAULT_ROWS = [1, 2]
ratio: object = bindable(15.0)
rows: object = bindable(DEFAULT_ROWS)


@export
def clear():
    global ratio, rows
    ratio = None
    rows = None


@export
def whole():
    global ratio
    ratio = 15


@export
def floated():
    global ratio
    ratio = 15.0


@export
def held():
    return repr(ratio)


@export
def same():
    return rows is DEFAULT_ROWS
</script>

<p data-k="child">{ratio}|{rows}</p>
