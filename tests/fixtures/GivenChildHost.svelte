<script lang="python">
# The child is handed by JavaScript, as a prop: no import here names it, and it
# is told apart once mounted, by what it says of itself.
Given: object = None
value = 15.0
</script>

{#snippet via(Child)}<span data-k="snippet"><Child value={value} /></span>{/snippet}

<span data-k="prop"><Given value={value} /></span>
{@render via(Given)}
