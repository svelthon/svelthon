<script>
    // The same form in Svelte: the witness for GroupMarkupCell.
    let shared = ['v1'];
</script>

<form data-k="form">
    {#each [0, 1] as row}
        {let picked = $state.raw([])}
        {let held = $state.raw(shared)}
        {let choice = $state.raw(0)}
        {let amount = $state.raw(0.25)}
        <div data-row={row}>
            <input data-k="picked" type="checkbox" value={'v' + row} bind:group={picked} />
            <input data-k="held" type="checkbox" value={'v' + row} bind:group={held} />
            <input data-k="choice" type="radio" value={row + 1} bind:group={choice} />
            <input data-k="amount" type="number" bind:value={amount} />
            <p data-k="state">{picked.join(',')}|{held.join(',')}|{choice}|{amount}</p>
        </div>
    {/each}
</form>
