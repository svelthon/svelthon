<script lang="python">
# Svelte 5 reads `bind:value={x}` and `bind:value="{x}"` as the same thing, and
# its own fixtures write the quoted form. The scanner used to see two doors, and
# every rule lived behind one of them.
missing = None
typed = "start"
tags = []


def note():
    global typed
    typed = "clicked"
</script>

<!-- The one with visible wrong output: skipping the pair skips __brycomp_bound, which
     is where None becomes undefined on the way to the DOM. -->
<input data-k="quoted_none" bind:value="{missing}">
<input data-k="bare_none" bind:value={missing}>

<input data-k="quoted_text" bind:value="{typed}">

<!-- Read for truthiness in one spelling and as text in the other, so an empty
     Python list was true through the quotes and false without them. -->
<b data-k="quoted_class" class:on="{tags}">tags</b>
<b data-k="bare_class" class:on={tags}>tags</b>

<button data-k="quoted_click" onclick="{note}">note()</button>

<p data-k="typed">{typed}</p>
