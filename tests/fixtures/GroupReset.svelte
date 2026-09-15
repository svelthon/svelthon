<script lang="python">
# `form.reset()` puts the controls back without firing `change` on any of them,
# so a group that only listens for `change` keeps whatever the clicks left in it
# while the form on screen says otherwise.
selected = ["b"]
choice = "y"
</script>

<form data-k="form">
    <input data-k="c-a" type="checkbox" value="a" bind:group={selected} />
    <input data-k="c-b" type="checkbox" value="b" bind:group={selected} />

    <!-- A radio group whose default is restored by the reset, and one whose
         inputs carry no default at all, so nothing comes back filled. -->
    <input data-k="r-x" type="radio" value="x" checked bind:group={choice} />
    <input data-k="r-y" type="radio" value="y" bind:group={choice} />

    <button data-k="reset" type="reset">reset</button>
</form>

<p data-k="selected">{selected}</p>
<p data-k="count">{len(selected)}</p>
<p data-k="choice">{choice}</p>
