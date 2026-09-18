<script lang="python">
# The rows come from JavaScript: a parent hands them in, so nothing of Brython's
# has converted them on the way.
items: list = []
</script>

<p data-k="rows">{#each items as item}{item}{/each}</p>
