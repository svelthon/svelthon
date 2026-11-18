<script lang="python">
# An object a JavaScript module hands, read in an attribute, a text and an
# expression, beside a count that renders the page again.
__js__ = {"./plain_object.js": ["plain"]}

count: int
</script>

<p data-x={plain.name}>{plain.name}|{count}</p>
<b>{plain.name + "!"}</b>
<svelte:boundary><i>{plain.name}|{count}</i></svelte:boundary>
