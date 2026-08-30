<script lang="python">
text = "draft"
saved = "no"


def save(value):
    global saved
    saved = value
    return value
</script>

<button onclick={lambda: save(draft := text)}>save</button>
<p data-k="saved">{saved}</p>
