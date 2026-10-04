<script lang="python">
# Groups bound to names the markup declares, one cell per row: a list of its
# own, a list every row starts from, a radio and a number.
shared = ["v1"]
</script>

<form data-k="form">
    {#each [0, 1] as row}
        {picked = []}
        {held = shared}
        {choice = 0}
        {amount = 0.25}
        <div data-row={row}>
            <input data-k="picked" type="checkbox" value={"v" + str(row)} bind:group={picked} />
            <input data-k="held" type="checkbox" value={"v" + str(row)} bind:group={held} />
            <input data-k="choice" type="radio" value={row + 1} bind:group={choice} />
            <input data-k="amount" type="number" bind:value={amount} />
            <p data-k="state">{",".join(picked)}|{",".join(held)}|{choice}|{amount}</p>
        </div>
    {/each}
</form>
