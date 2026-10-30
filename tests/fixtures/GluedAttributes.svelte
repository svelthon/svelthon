<script lang="python">
# Attributes glued to what comes before them, as Svelte reads them: after a
# spread, an attachment or a shorthand, which a name read across their braces
# became part of, and after a value this pass writes braced, a shorthand or a
# lone interpolation between quotes, which a braced value glued to the next
# attribute is not, to Svelte.
attrs = {}
items = []
name = "Ada"
label = "l"
count = 0


def decorate(node):
    pass


def mark(node, value):
    node.setAttribute("data-mark", value)


def bump():
    global count
    count += 1


@export
def toggle():
    global items
    items = [] if items else [1]
</script>

<button data-k="disabled" {**attrs}disabled={items}>disabled</button>
<p data-k="hidden" {@attach decorate}hidden="{items}">hidden</p>
<span data-k="class" {**attrs}class:active={items}>class</span>
<input data-k="bound" {**attrs}bind:value={name} />
<p data-k="name">{name}</p>

<p data-k="short" {label}title="literal">short</p>
<p data-k="quoted" hidden="{items}"title="t">quoted</p>
<button data-k="handler" onclick="{bump}"title="t">{count}</button>
<p data-k="action" use:mark="{label}"title="t">action</p>
