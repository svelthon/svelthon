<script lang="python">
    # A group's selection, which a server writes into the HTML.
    picked = ["one"]
    chosen = "two"
</script>

<input type="checkbox" value="one" bind:group={picked} />
<input type="checkbox" value="two" bind:group={picked} />
<input type="radio" value="one" bind:group={chosen} />
<input type="radio" value="two" bind:group={chosen} />
