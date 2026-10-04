<script lang="python">
seed = 0
</script>

{#if True}
    {amount = 0.25}
    {nothing = None}
    {selected = 0.25}
    {many = [0.25, 0.5]}
    <input data-k="number" type="number" bind:value={amount} />
    <input data-k="text" type="text" bind:value={amount} />
    <input data-k="range" type="range" min="0" max="1" step="0.01" bind:value={amount} />
    <input data-k="nothing" type="text" bind:value={nothing} />
    <select data-k="select" bind:value={selected}>
        <option value={0.25}>quarter</option>
        <option value={0.5}>half</option>
    </select>
    <select data-k="many" multiple bind:value={many}>
        <option value={0.25}>quarter</option>
        <option value={0.5}>half</option>
    </select>
    <output data-k="amount">{amount}</output>
    <output data-k="selected">{selected}</output>
{/if}
