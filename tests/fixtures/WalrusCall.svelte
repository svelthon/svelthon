<script lang="python">
a = 0
b = 0
</script>

<button onclick={lambda: (a := 1, b := 2)}>both</button>
<p data-k="a">{a}</p>
<p data-k="b">{b}</p>
