<script lang="python">
# A counter with a field beside it. Everything a parent and a child can exchange
# passes through props; the field is here for the one thing that cannot, since
# "be focused now" is an act and not a value.
start: int = 0
on_change: callable = None
count: int <=>

field = None


def value():
    return start if count is None else count


@export
def focus():
    # What a prop cannot carry. A `should_focus` flag would have to be watched,
    # acted on, then cleared, or a second request would do nothing.
    field.focus()


def add():
    global count
    count = value() + 1

    if on_change is not None:
        on_change(count)
</script>

<span class="child">
    count = <b>{value()}</b>
    <button onclick={add}>+1</button>
    <input bind:this={field} placeholder="a field to focus" />
</span>
