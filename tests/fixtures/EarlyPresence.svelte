<script lang="python">
# A cleanup that may run before the first flush, asking whether a function and
# a derived are bound, which `globals()` reads off a source of its own. The
# derived raises if its body runs: asking whether it is bound runs nothing.
capture: object


def helper():
    return "h"


@derived
def dangerous():
    raise ValueError("ran")


@effect.pre
def watch():
    capture("run", "helper" in globals(), "dangerous" in globals())
    return lambda: capture("clean", "helper" in globals(), "dangerous" in globals(), "dangerous" in list(globals()))
</script>

<p>ready</p>
