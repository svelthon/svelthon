<script lang="python">
import counter_store


def increment():
    counter_store.increment()


def reset():
    counter_store.reset()
</script>

<button onclick={increment}>increment()</button>
<button onclick={reset}>reset()</button>
<output>{counter_store.count} · {counter_store.history}</output>
