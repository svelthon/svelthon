<script lang="python">
onclick = None
seen = 0

def bump(event=None):
    global seen
    seen += 1

onclick = bump
</script>

<button {onclick}>go</button>
<p data-k="seen">{seen}</p>
