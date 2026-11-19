<script lang="python">
key = "score"


@export
def write(value):
    globals()[key] = value
    globals()["literal"] = value
</script>
<p data-k="view">{globals().get(key, "pending")}|{globals().get("literal", "pending")}</p>
