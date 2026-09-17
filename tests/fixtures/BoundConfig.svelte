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


def ease(t):
    return t * t


class Curve:
    def ease(self, t):
        return t * t


curve = Curve()


@export
def bound_config():
    return {"duration": 0.5, "tick": ticker.tick}


@export
def plain_config():
    # The witness: an ordinary function calling the same method.
    return {"duration": 0.5, "tick": plain_tick}


@export
def easing_config():
    # What Svelte consumes in `t1 + delta * easing(t)`: the *result* has to be a
    # JavaScript number, not a Brython float.
    return {"easing": ease}


@export
def bound_easing_config():
    return {"easing": curve.ease}


@export
def reset():
    ticker.last = "untouched"


@export
def last():
    return ticker.last
</script>

<p data-k="last">{ticker.last}</p>
