<script lang="python">
# `v` is what anyone writes after a decade of `for k, v in d.items()`. It is
# also what the generated setter called its parameter, so for this one spelling
# the parameter shadowed the cell the assignment was meant for and the name was
# `<Javascript undefined>` for the life of the component. Nothing was reported.
v = 1 / 3
n = 1 / 3

count = 0


def bump():
    global count
    count = count + 1


items = {"a": 1}


def joined():
    # The same letter inside a `def` is an ordinary local and was always
    # correct: only a module-level name gets a binding.
    return "-".join(f"{k}{v}" for k, v in items.items())
</script>

<p data-k="v_type">{type(v).__name__}</p>
<p data-k="n_type">{type(n).__name__}</p>
<p data-k="v">{v}</p>
<p data-k="loop">{joined()}</p>
<button data-k="bump" onclick={bump}>bump()</button>
<p data-k="count">{count}</p>
