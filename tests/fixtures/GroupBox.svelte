<script lang="python">
# One checkbox, bound to this instance's own list. Two of these in a form are two
# groups, even when the parent hands them the same list to start from.
initial: list
value: str

selected = initial
</script>

<input data-k="box-{value}" type="checkbox" value={value} checked bind:group={selected} />
<p data-k="held-{value}">{selected}</p>
