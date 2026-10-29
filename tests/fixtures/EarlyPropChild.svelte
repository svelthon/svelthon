<script lang="python">
# A pre effect whose cleanup reads the prop its Python parent passes, its
# decorator spelled over two lines, as Python lets it be.
n: object
capture: object


@(effect.
    # the effect runs before the DOM is updated
    pre)
def watch():
    capture("run", n)
    return lambda: capture("clean", n)
</script>

<output>{n}</output>
