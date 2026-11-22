<script lang="python">
# Iterating the module's globals() while the module binds a name ends the walk,
# as CPython ends it; replacing a value does not.
value = 1


@export
def walk(form, change):
    global value, added_iter, added_keys, added_items, added_values
    g = globals()
    it = iter(g) if form == "iter" else iter(getattr(g, form)())
    next(it)
    if change == "replace":
        value = 2
    elif form == "iter":
        added_iter = 7
    elif form == "keys":
        added_keys = 7
    elif form == "items":
        added_items = 7
    else:
        added_values = 7
    try:
        next(it)
        return "went on"
    except RuntimeError:
        return "RuntimeError"
    except StopIteration:
        return "went on"
</script>

<p>ready</p>
