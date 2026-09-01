<script lang="python">
n = 1

def bump():
    global n
    n += 1
</script>

{#key n}<p data-k="key">{n}</p>{/key}
<button onclick={bump}>b</button>
