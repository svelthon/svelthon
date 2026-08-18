<script lang="python">
name = "ada"
n = 0

def shout():
    global name
    name = name.upper()
</script>

<input data-k="text" bind:value={name} />
<input data-k="num" type="number" bind:value={n} />
<p data-k="echo">{name}/{n}</p>
<button data-k="shout" onclick={shout}>shout</button>
