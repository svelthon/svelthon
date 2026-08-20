<script lang="python">
tag: str = "?"

count = 0
items = []          # mutable default: every instance must get its own

def bump():
    global count
    count += 1
    items.append(count)
</script>

<p data-k="state">{tag}:{count}:{items}</p>
<button data-k="bump" onclick={bump}>bump</button>
