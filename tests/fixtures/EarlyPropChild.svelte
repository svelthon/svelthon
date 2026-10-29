<script lang="python">
# A pre effect whose cleanup reads the prop its Python parent passes.
n: object
capture: object


@effect.pre
def watch():
    capture("run", n)
    return lambda: capture("clean", n)
</script>

<output>{n}</output>
