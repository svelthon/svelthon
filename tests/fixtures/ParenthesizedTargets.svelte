<script lang="python">
    amount = "old"
    picked = []
</script>

<input data-k="script" bind:value={(amount)} />
<output data-k="script">{amount}</output>
{#if True}
    {level = "old"}
    <input data-k="markup" bind:value={((level))} />
    <output data-k="markup">{level}</output>
{/if}
<input data-k="group" type="checkbox" value="x" bind:group={(picked)} />
<output data-k="group">{",".join(picked)}</output>
