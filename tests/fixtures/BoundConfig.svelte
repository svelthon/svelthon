<script lang="python">
# A configuration handed to JavaScript: a number and a callback the framework
# keeps and calls itself, which is the shape of a transition's options.
class Ticker:
    def __init__(self):
        self.last = "untouched"

    def tick(self, t, u):
        self.last = format(t, ".2f")


ticker = Ticker()


def plain_tick(t, u):
    ticker.tick(t, u)


@export
def bound_config():
    return {"duration": 0.5, "tick": ticker.tick}


@export
def plain_config():
    # The witness: an ordinary function calling the same method.
    return {"duration": 0.5, "tick": plain_tick}


@export
def reset():
    ticker.last = "untouched"


@export
def last():
    return ticker.last
</script>

<p data-k="last">{ticker.last}</p>
