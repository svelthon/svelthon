<script lang="python">
import root_store
</script>

<p data-k="count">{root_store.count}</p>
<button data-k="bump" onclick={lambda: root_store.bump()}>bump</button>
<button data-k="stop" onclick={lambda: root_store.destroy()}>stop</button>
