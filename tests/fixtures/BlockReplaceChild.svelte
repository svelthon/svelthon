<script lang="python">
# Puts a list of its own in the binding its parent hands it.
rows: object <=>
fresh = [1]


def replace():
    global rows
    rows = fresh
</script>

<button data-k="replace" onclick={replace}>replace</button>
