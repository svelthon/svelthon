<script lang="python">
import iterated_rows as cases

name: str = "real"
</script>

<p data-k="rows">{#each cases.rows(name) as row}{row}{/each}</p>
