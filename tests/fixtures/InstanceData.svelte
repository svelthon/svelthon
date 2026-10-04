<script lang="python">
# Data a parent holding `bind:this` reads through the instance's API, then
# changed in place by the component.
conf = {"count": 0, "rate": 0.5, "none": None}
rows = [1, 2]


@export
def config():
    return conf


@export
def items():
    return rows


@export
def bump():
    conf["count"] += 1
    rows.append(3)
</script>
