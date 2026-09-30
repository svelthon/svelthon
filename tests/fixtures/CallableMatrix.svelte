<script lang="python">
import callable_matrix


@export
def config(key):
    # What a host keeps and calls itself: a number and a callback, the shape of
    # a transition's options. This is the one crossing that runs `pyNumbers`.
    return {"hook": callable_matrix.mapped[key], "duration": 0.5}


@export
def returned(key):
    # The same callback, handed back whole rather than inside a config.
    return callable_matrix.mapped[key]


@export
async def returned_later(key):
    return callable_matrix.mapped[key]


@export
def returned_native(own):
    return own
</script>

<p data-k="ready">ready</p>
