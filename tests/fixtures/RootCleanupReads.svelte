<script lang="python">
# A pre root that stops itself the first time it runs, which is while it is
# made, and whose cleanup reads a name of one kind when it runs, as a Python
# closure reads a global: the cleanup runs before the first flush.
mode: str
capture: object
label: str = "x"
tag: str = bindable("t")
count = 7


def helper():
    return "h"


@derived
def double():
    return count * 2


@effect
def watcher():
    js.String(count)


@effect.root
@effect.pre
def root():
    capture("run", count)
    if count == 7:
        root()
    if mode == "state":
        return lambda: capture("clean", count)
    if mode == "function":
        return lambda: capture("clean", helper())
    if mode == "derived":
        return lambda: capture("clean", double)
    if mode == "effect":
        return lambda: capture("clean", callable(watcher))
    if mode == "root":
        return lambda: capture("clean", callable(root))
    if mode == "prop":
        return lambda: capture("clean", label)
    if mode == "bindable":
        return lambda: capture("clean", tag)

    def clean():
        capture("clean", count)

    return clean
</script>

<output>{count}</output>
