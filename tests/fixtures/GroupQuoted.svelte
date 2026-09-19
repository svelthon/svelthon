<script lang="python">
# Every spelling a group value can be written in, on one component, with
# something under each of them that moves. The witness beside it is
# `GroupQuotedNative.svelte`, the same markup in Svelte's own language: what it
# does is the answer, and no literal in the test is.
n = 1
text = "b"

one = ""
mixed = ""
two = ""
braced = ""
plain = ""


def change():
    global n, text
    n = 2
    text = "c"


@export
def kind(which):
    # The type the page cannot show: a number and its spelling render the same.
    return type({"one": one, "mixed": mixed, "two": two, "braced": braced}[which]).__name__
</script>

<button data-k="change" onclick={change}>change</button>

<input data-k="one" type="radio" value="{n}" bind:group={one} />
<input data-k="mixed" type="radio" value="a-{n}" bind:group={mixed} />
<input data-k="two" type="radio" value="{n}{text}" bind:group={two} />
<input data-k="braced" type="radio" value={n} bind:group={braced} />
<input data-k="static" type="radio" value="fixed" bind:group={plain} />

<p data-k="one">{one}</p>
<p data-k="mixed">{mixed}</p>
<p data-k="two">{two}</p>
<p data-k="braced">{braced}</p>
<p data-k="static">{plain}</p>
