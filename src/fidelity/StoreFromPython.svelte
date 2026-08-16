<script lang="python">
import counter_store

seen = 0

def bump_twice():
    global seen
    counter_store.increment()
    counter_store.increment()
    seen = counter_store.count
</script>

<p data-k="seen">{seen}</p>
<button data-k="bump" onclick={bump_twice}>bump</button>
