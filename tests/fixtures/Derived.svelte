<script lang="python">
first = "Ada"
last = "Lovelace"
@derived
def full():
    return f"{first} {last}"

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
