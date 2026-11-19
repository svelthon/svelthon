<script lang="python">
@export
def write(value):
    globals().update({"len": lambda values: value})
</script>
<p data-k="view">{len([1, 2])}</p>
