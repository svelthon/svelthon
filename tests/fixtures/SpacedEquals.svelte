<script lang="python">
# Whitespace before an attribute's `=`, which Svelte reads as it reads it after
# the `=`: a space, a tab and a line break, before a braced value, a quoted one,
# and an unquoted one an expression is glued onto.
items = []
name = "Ada"
on = False
rest = "ed"
count = 0

def bump():
    global count
    count += 1

@export
def toggle():
    global items, on
    items = [] if items else [1]
    on = not on
</script>

<button data-k="disabled" disabled = {items}>off</button>
<p data-k="hidden" hidden	= "{items}">text</p>
<button data-k="click" onclick
    = {bump}>{count}</button>
<input data-k="bound" bind:value = {name} />
<p data-k="class" class:active = "{on}">class</p>
<p data-k="style" style:color = {"red" if on else "blue"}>style</p>
<p data-k="glued" style:color = r{rest}>glued</p>
<p data-k="name">{name}</p>
