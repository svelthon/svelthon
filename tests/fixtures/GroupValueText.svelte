<script lang="python">
# A quoted group value is built twice: once by Svelte for the node, once by the
# compiler for the model. Every input here is one the two used to disagree on.
data = {"id": 7}
n = 1
none = None
no = False
picks = {
    key: "unset"
    for key in [
        "nested", "nested-text", "amp", "numeric", "nbsp", "none-after",
        "none-before", "none-twice", "false-after", "false-twice", "none-alone",
    ]
}


@export
def held(key):
    return repr(picks[key])


@export
def text(key):
    return picks[key]


@export
def change():
    data["id"] = 8
</script>

<input data-k="nested" type="radio" value="{data["id"]}" bind:group={picks["nested"]} />
<input data-k="nested-text" type="radio" value="item-{data["id"]}" bind:group={picks["nested-text"]} />

<input data-k="amp" type="radio" value="a&amp;{n}" bind:group={picks["amp"]} />
<input data-k="numeric" type="radio" value="a&#38;{n}" bind:group={picks["numeric"]} />
<input data-k="nbsp" type="radio" value="a&nbsp;{n}" bind:group={picks["nbsp"]} />

<input data-k="none-after" type="radio" value="a-{none}" bind:group={picks["none-after"]} />
<input data-k="none-before" type="radio" value="{none}-a" bind:group={picks["none-before"]} />
<input data-k="none-twice" type="radio" value="{none}{none}" bind:group={picks["none-twice"]} />
<input data-k="false-after" type="radio" value="a-{no}" bind:group={picks["false-after"]} />
<input data-k="false-twice" type="radio" value="{no}{no}" bind:group={picks["false-twice"]} />

<input data-k="none-alone" type="radio" value="{none}" bind:group={picks["none-alone"]} />
