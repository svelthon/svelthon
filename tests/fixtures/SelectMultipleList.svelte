<script lang="python">
selected = [0.25]


def clear():
    selected.clear()
</script>

<select data-k="script" multiple bind:value={selected}>
    <option value={0.25}>quarter</option>
    <option value={0.5}>half</option>
</select>
<button onclick={clear}>clear</button>
<output>{len(selected)}</output>

{#if True}
    {chosen = [0.25]}
    <select data-k="cell" multiple bind:value={chosen}>
        <option value={0.25}>quarter</option>
        <option value={0.5}>half</option>
    </select>
    <p>{type(chosen).__name__} {chosen}</p>
{/if}
