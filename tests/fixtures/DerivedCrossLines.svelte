<script lang="python">
# Two declarations sharing a line, then a write of the first: the marker of
# the second leaves the first bound, for a number, a function written as a
# value, an effect, and a `:=` written before the second's binding.
notify: object = None
base = 1


def body(value):
    return lambda: base * 7


def run():
    notify(f"run {base}")


a = derived(lambda: base * 2); b = derived(lambda: base * 3); a = 99
c = derived(lambda: base * 4); d = derived(lambda: base * 5); c = lambda: 7
e = derived(lambda: base * 6); f = derived(body(f := 1))
x = effect(run); y = effect(lambda: None); x = 99


@export
def held():
    return f"{a} {b} {callable(c)} {d} {e} {f} {x}"


@export
def bump():
    global base
    base += 1
</script>

<p data-k="shown">{a} {b} {d} {e} {f}</p>
