<script lang="python">
count: int = None
turn = 0


def attempt(at):
    global count
    if at != 1:
        return "idle"
    try:
        count = 5
        return "accepted"
    except Exception:
        return "refused"


@export
def step():
    global turn
    turn += 1


@export
def retry():
    global count
    count = 5
</script>

<i>{attempt(turn)}</i>
<p>{count}</p>
