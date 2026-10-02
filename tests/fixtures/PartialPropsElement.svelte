<svelte:options customElement={{
    tag: 'partial-props-element',
    shadow: 'none',
    props: {
        middle: { type: 'Number', reflect: true },
        extra: { type: 'String' },
    },
}} />

<script lang="python">
# One prop configured by the author, after a trailing comma and beside a name
# the script does not declare: the other two are observed all the same. The
# witness is `PartialPropsElementNative.svelte`.
first: str = "a"
middle: int = 1
last: str = "z"
</script>

<p>{first}|{middle}|{last}</p>
