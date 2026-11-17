<script lang="python">
items: list = bindable()
own = [5, 5]
second = [9, 9, 9, 9]
turn = 0


def attempt(at):
    global items
    if at != 1:
        return "idle"
    try:
        items = second
        return "accepted"
    except Exception:
        return "refused"


@export
def override():
    global items
    items = own


@export
def step():
    global turn
    turn += 1


@export
def grow():
    own.append(1)


@export
def retry():
    global items
    items = second
</script>

<i>{attempt(turn)}</i>
<p>{len(items)}</p>
