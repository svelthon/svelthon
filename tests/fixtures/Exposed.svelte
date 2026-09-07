<script lang="python">
# What a parent holding `bind:this` may call, and what it may not. Only the
# decorated ones cross; the rest stay the component's own business.
count = 0
field = None


@export
def bump(by=1):
    global count
    count += by
    return count


@export
def focus():
    field.focus()


# The call form, which is what their `export const focus = () => …` looks like
# in Python. Every marker here answers to both spellings.
doubled = export(lambda n: n * 2)


def internal():
    # No decorator, so a parent must not see it, exactly as an undecorated
    # function is invisible on a Svelte instance.
    return "private"
</script>

<p data-k="count">{count}</p>
<input bind:this={field} />
