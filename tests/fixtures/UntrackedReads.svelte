<script lang="python">
# The same reads in the template and in a handler: an attribute of an instance
# nobody watches, and one of a class through an instance the component watches.
class Tile:
    kind = "square"

    def __init__(self):
        self.size = 1


tile = Tile()


def add_up():
    made = Tile()
    for _ in range(10):
        made.size
        tile.kind
</script>

<button onclick={add_up}>add up</button>
<p>{Tile().size} {tile.kind}</p>
