<script lang="python">
count = 0


def note(tag):
    body = js.document.body
    body.setAttribute("data-root", (body.getAttribute("data-root") or "") + tag)


# The decorated name receives what `$effect.root` hands back, exactly as
# JavaScript writes `const destroy = $effect.root(…)`.
@effect.root
def destroy():
    js.String(count)
    note("r")


def bump():
    global count
    count += 1


def stop():
    destroy()
</script>

<p data-k="count">{count}</p>
<button data-k="bump" onclick={bump}>bump</button>
<button data-k="stop" onclick={stop}>stop</button>
