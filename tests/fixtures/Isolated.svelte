<script lang="python">
tag: str = "?"

count = 0
items = []          # défaut mutable : chaque instance doit avoir le sien

def bump():
    global count
    count += 1
    items.append(count)
    publish("items")
</script>

<p data-k="state">{tag}:{count}:{items}</p>
<button data-k="bump" onclick={bump}>bump</button>
