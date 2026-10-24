<script lang="python">
# The markers under another name, called and used as a decorator: the
# identity, which marks no declaration, so one after them still holds what a
# `:=` wrote before its binding, for a derived as for an effect.
notify: object = None
base = 1
alias = derived
ignored = alias(lambda: 0)
effected = effect
quiet = effected(lambda: None)


@alias
def plain():
    return 5


def build(value):
    return lambda: base * 2


a = derived(build(a := 99))


@effect
def watch(ignored=(watch := 99)):
    notify(f"watch {base}")


@export
def held():
    return f"{callable(ignored)} {callable(quiet)} {plain()} {callable(a)} {a}"


@export
def bump():
    global base
    base += 1
</script>

<p data-k="shown">{a}</p>
