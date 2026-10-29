<script lang="python">
# A pre effect whose cleanup reads a global as it runs, which a component
# unmounted before its first flush runs at once.
capture: object
count = 7


@effect.pre
def watch():
    capture("run", count)
    return lambda: capture("clean", count)
</script>

<output>{count}</output>
