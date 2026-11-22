<script lang="python">
key = "score"


@export
def write(value):
    global score, literal
    score = value
    literal = value
</script>
<p data-k="view">{globals().get(key, "pending")}|{globals().get("literal", "pending")}</p>
