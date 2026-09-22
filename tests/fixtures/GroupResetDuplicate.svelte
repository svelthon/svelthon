<script lang="python">
# Two controls standing for one choice, which is what a form does when it shows
# the same option in two sections — and a reset puts every one of them back at
# once, without firing `change` on any.
#
# The lists start empty while the markup says `checked`, so the reset is what
# fills them: on mount the binding writes the list into the controls and they
# come up empty, and `form.reset()` then restores the attributes.
selected = []
halves = []
rows = [{"name": "first", "selected": []}, {"name": "second", "selected": []}]
</script>

<form data-k="form">
    <input data-k="a1" type="checkbox" value="a" checked bind:group={selected} />
    <input data-k="b" type="checkbox" value="b" bind:group={selected} />
    <input data-k="a2" type="checkbox" value="a" checked bind:group={selected} />

    <!-- Equal and not the same object: a Brython float is `{ob_type, value}`,
         so `value={0.5}` written twice is two objects, and only Python's `==`
         says they are one choice. -->
    <input data-k="h1" type="checkbox" value={0.5} checked bind:group={halves} />
    <input data-k="h2" type="checkbox" value={0.5} checked bind:group={halves} />

    <!-- And the same pair on every row of a loop, which is where a group's
         identity is only told apart by the list it holds. -->
    {#each rows as row, at}
        <input data-k="r{at}-1" type="checkbox" value="x" checked bind:group={row["selected"]} />
        <input data-k="r{at}-2" type="checkbox" value="x" checked bind:group={row["selected"]} />
    {/each}

    <button data-k="reset" type="reset">reset</button>
</form>

<p data-k="selected">{",".join(selected)}</p>
<p data-k="halves">{",".join(str(one) for one in halves)}</p>
<p data-k="rows">{" / ".join(",".join(row["selected"]) for row in rows)}</p>
