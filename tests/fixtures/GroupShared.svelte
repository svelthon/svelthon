<script lang="python">
# Two bindings that happen to hold the same list. Sharing a value is not sharing
# a binding: the reset has to rebuild two groups, not one.
shared = []
left = shared
right = shared
</script>

<form data-k="form">
    <input data-k="l-a" type="checkbox" value="a" checked bind:group={left} />
    <input data-k="r-b" type="checkbox" value="b" checked bind:group={right} />
</form>

<p data-k="left">{left}</p>
<p data-k="right">{right}</p>
