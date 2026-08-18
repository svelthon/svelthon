<script lang="python">
import counter_store


def inc():
    counter_store.increment()
</script>

<p data-k="a">A:{counter_store.count}:{counter_store.history}</p>
<button data-k="inc" onclick={inc}>+</button>
