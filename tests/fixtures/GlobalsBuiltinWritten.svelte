<script lang="python">
@export
def write(value):
    globals()["len"] = lambda values: value


@export
def erase():
    globals().pop("len", None)
</script>
<p data-k="view">{len([0, 1])}</p>
