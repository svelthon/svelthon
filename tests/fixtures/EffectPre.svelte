<script lang="python">
count = 0


# Written to the DOM rather than to state: an effect that appends to a
# module-level list reads it to call `.append`, so it would depend on what it
# writes and Svelte would loop.
def note(tag):
    body = js.document.body
    body.setAttribute("data-order", (body.getAttribute("data-order") or "") + tag)


@effect.pre
def before():
    js.String(count)
    note("<")


@effect
def after():
    js.String(count)
    note(">")


def bump():
    global count
    count += 1
</script>

<p data-k="count">{count}</p>
<button onclick={bump}>bump</button>
