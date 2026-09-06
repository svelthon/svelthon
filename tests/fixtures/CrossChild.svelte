<script lang="python">
# The prop direction, one container of each kind.
one: dict = None
two: list = None
three: set = None


def describe(value):
    return "{} len={}".format(type(value).__name__, len(value))
</script>

<p data-k="dict-prop">{describe(one)}</p>
<p data-k="list-prop">{describe(two)}</p>
<p data-k="set-prop">{describe(three)}</p>
