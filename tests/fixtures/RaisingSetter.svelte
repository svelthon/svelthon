<script lang="python">
# A `__setattr__` of the author's that writes and then raises. An exception does
# not undo the write, so the page has to follow the model.
class Box:
    def __init__(self, angry):
        object.__setattr__(self, "angry", angry)
        object.__setattr__(self, "value", 0)

    def __setattr__(self, name, value):
        object.__setattr__(self, name, value)
        if self.angry:
            raise ValueError("written before failure")


angry = Box(True)
calm = Box(False)


def go():
    try:
        angry.value = 1
    except ValueError:
        pass


def quiet():
    calm.value = 1
</script>

<button data-k="angry" onclick={go}>angry</button>
<button data-k="calm" onclick={quiet}>calm</button>
<p data-k="angry-value">{angry.value}</p>
<p data-k="calm-value">{calm.value}</p>
