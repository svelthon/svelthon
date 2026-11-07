<script lang="python">
# A radio group that offers None as a choice, beside a form reset. The witness
# is `GroupResetNoneNative.svelte`.
choice = None


@export
def seen():
    return repr(choice)
</script>

<form>
    <input data-k="none" type="radio" name="r" value={None} bind:group={choice} />
    <input data-k="b" type="radio" name="r" value={"b"} bind:group={choice} />
</form>
<p data-k="choice">{choice}</p>
