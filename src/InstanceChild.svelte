<script lang="python">
# A counter. Everything a parent and a child can exchange, they exchange about
# this one number: the parent sets where it starts, the child says when it
# moves, and both may hold it at once.
start: int = 0
on_change: callable = None
count: int <=>


def value():
    return start if count is None else count


def add():
    global count
    count = value() + 1

    if on_change is not None:
        on_change(count)
</script>

<span class="child">
    count = <b>{value()}</b>
    <button onclick={add}>+1</button>
</span>
