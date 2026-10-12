<script lang="python">
# Props the child deletes, and its parent passes again.
label: str = "a"
level: int = bindable(1)


@export
def drop():
    global label, level
    del label
    del level


@export
def listed():
    # Asked of globals() alone, before anything reads the names.
    g = globals()
    return " ".join(str(item) for item in ("label" in g, "label" in list(g), g.get("label", "missing"), "level" in g))


@export
def seen():
    out = []
    for read in (lambda: label, lambda: level):
        try:
            out.append(str(read()))
        except NameError:
            out.append("missing")
    return " ".join(out + [str("label" in globals()), str("level" in globals())])
</script>

<p>child</p>
