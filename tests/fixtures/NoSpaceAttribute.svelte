<script lang="python">
# HTML lets an attribute follow a quoted value with no space, and Svelte's
# parser follows HTML. The scanner read the name with a class that did not
# exclude the quote, so `title="y"onclick` was the name, and it matched no rule:
# the handler was never wrapped and the button was dead with nothing said.
#
# The binding face lives next door, in NoSpaceBind.svelte: Svelte refuses the
# shape it degrades to, so that one is loud and would hide this one.
count = 0
tags = []


def go():
    global count
    count += 1
</script>

<button data-k="spaced" title="y" onclick={go}>ok</button>
<button data-k="tight" title="y"onclick={go}>ko</button>

<b data-k="tight_class" title="y"class:on={tags}>tags</b>

<p data-k="count">{count}</p>
