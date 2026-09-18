<script lang="python">
import iterating_subclass as cases
</script>

<p data-k="custom">{#each cases.rows as row}{row}{/each}</p>
<p data-k="plain">{#each cases.plain as row}{row}{/each}</p>
<p data-k="python">{cases.python_order()}</p>
