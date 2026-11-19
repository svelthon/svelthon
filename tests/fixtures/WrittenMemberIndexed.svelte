<script lang="python">
ticket: dict
revision: int

confirmation => ticket["label"] + "!"


def edit():
    globals()["ticket"]["label"] = "mine"
</script>

<p data-k="child">{revision}|{ticket["label"]}|{confirmation}</p>
<button data-k="edit" onclick={edit}>e</button>
