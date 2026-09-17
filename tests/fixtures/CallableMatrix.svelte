<script lang="python">
import callable_matrix


@export
def config(key):
    # What a host keeps and calls itself: a number and a callback, the shape of
    # a transition's options. This is the one crossing that runs `pyNumbers`.
    return {"hook": callable_matrix.mapped[key], "duration": 0.5}
</script>

<p data-k="ready">ready</p>
