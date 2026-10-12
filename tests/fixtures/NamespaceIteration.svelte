<script lang="python">
# Iterating the module's globals() while a key is added through it ends the
# walk, as CPython ends it; replacing a value does not.
value = 1


@export
def walk(form, change):
    g = globals()
    it = iter(g) if form == "iter" else iter(getattr(g, form)())
    next(it)
    if change == "add":
        g["added_" + form] = 7
    else:
        g["value"] = 2
    try:
        next(it)
        return "went on"
    except RuntimeError:
        return "RuntimeError"
    except StopIteration:
        return "went on"
</script>

<p>ready</p>
