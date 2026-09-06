<script lang="python">
node = None
tag = ""

def on_mount():
    global tag
    tag = node.tagName.lower()
</script>

<section bind:this={node}></section>
<p data-k="this">{tag}</p>
