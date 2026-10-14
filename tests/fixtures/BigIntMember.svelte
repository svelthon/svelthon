<script lang="python">
# A set the template reads through, adding a large int it holds already.
flags = {2 ** 70}


def read():
    flags.add(2 ** 70)
    return len(flags)
</script>

<output>{read()}</output>
