<script lang="python">
# A dict and a list in a dict changed in place, and a JavaScript parent's
# record, spread on a `<svelte:element>` beside the same spread on an element,
# or read there for their truth; and a call, which Svelte calls again only when
# what it read changes.
record: object
count: int
tally: object

attrs = {"title": "t1"}
nested = {"class": ["a"]}
items = []
tag = "p"


def bump():
    attrs["title"] = "t2"
    nested["class"].append("b")
    items.append(1)


def make():
    tally()
    return {"title": "m"}
</script>

<button data-k="go" onclick={bump}>go</button>
<svelte:element this={tag} data-k="named" {**attrs}>x</svelte:element>
<svelte:element this={"p"} data-k="written" {**attrs}>x</svelte:element>
<p data-k="plain" {**attrs}>x</p>
<svelte:element this={tag} data-k="nested" {**nested}>x</svelte:element>
<svelte:element this={tag} data-k="record" {**record} data-c={count}>x</svelte:element>
{#if count >= 0}<svelte:element this={tag} data-k="block" {**attrs}>x</svelte:element>{/if}
<svelte:element this={tag} data-k="made" {**make()} data-c={count}>x</svelte:element>
<svelte:element this={tag} data-k="locked" hidden={record.locked} data-c={count}>x</svelte:element>
<svelte:element this={tag} data-k="filled" hidden={items}>x</svelte:element>
