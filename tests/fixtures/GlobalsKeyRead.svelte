<script lang="python">
@export
def write(value):
    globals()["future"] = value
</script>
<p data-k="view">{globals().get("future")}|{globals()["future"] if "future" in globals() else "none"}</p>
