<script lang="python">
label = ""

def mark(node, params):
    node.dataset.mark = params["k"]
    return None
</script>

<p data-k="use" use:mark={{"k": "yes"}}>x</p>
