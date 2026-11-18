<script lang="python">
# An object JavaScript hands as a prop, read in an attribute, a text and an
# expression, beside a count that renders the page again.
obj: object
count: int
</script>

<p data-x={obj.name}>{obj.name}|{count}</p>
<b>{obj.name + "!"}</b>
<svelte:boundary><i>{obj.name}|{count}</i></svelte:boundary>
