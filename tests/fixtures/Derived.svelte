<script lang="python">
first = "Ada"
last = "Lovelace"
# The expression form, which is the common case.
full => f"{first} {last}"


# And the body form, for anything that needs statements. One derived reads
# another either way.
@derived
def shouted():
    return full.upper()

def rename():
    global first
    first = "Grace"
</script>

<p data-k="full">{full}</p>
<p data-k="shouted">{shouted}</p>
<button data-k="rename" onclick={rename}>renommer</button>
