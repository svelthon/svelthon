<script lang="python">
# A `__setattr__` and a `__delattr__` of the author's that act and then raise. An
# exception undoes neither, so the page has to follow the model. A flag chooses
# which pair raises, so the witness differs by that word alone.
#
# The deletions use boxes of their own: reading `.value` after removing it would
# raise in the paragraph rather than show the defect.
class Box:
    def __init__(self, angry):
        object.__setattr__(self, "angry", angry)
        object.__setattr__(self, "value", 0)

    def __setattr__(self, name, value):
        object.__setattr__(self, name, value)
        if self.angry:
            raise ValueError("written before failure")

    def __delattr__(self, name):
        object.__delattr__(self, name)
        if self.angry:
            raise ValueError("deleted before failure")


angry = Box(True)
calm = Box(False)

angry_gone = Box(True)
calm_gone = Box(False)


def go():
    try:
        angry.value = 1
    except ValueError:
        pass


def quiet():
    calm.value = 1


def drop_angry():
    try:
        del angry_gone.value
    except ValueError:
        pass


def drop_calm():
    del calm_gone.value


def angry_has():
    return hasattr(angry_gone, "value")


def calm_has():
    return hasattr(calm_gone, "value")
</script>

<button data-k="angry" onclick={go}>angry</button>
<button data-k="calm" onclick={quiet}>calm</button>
<p data-k="angry-value">{angry.value}</p>
<p data-k="calm-value">{calm.value}</p>

<button data-k="drop-angry" onclick={drop_angry}>drop angry</button>
<button data-k="drop-calm" onclick={drop_calm}>drop calm</button>
<p data-k="angry-has">{angry_has()}</p>
<p data-k="calm-has">{calm_has()}</p>
