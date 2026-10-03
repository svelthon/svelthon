<script lang="python">
# A child a list subclass hands out from its class, read through the
# instance: it is the instance's to show after the instance is emptied.
class Box:
    def __init__(self):
        self.value = 0

class Shelf(list):
    pass

Shelf.shared = Box()

rows = Shelf([Box()])

@export
def detach():
    rows.clear()

@export
def mutate():
    Shelf.shared.value += 1
</script>

<p>{rows.shared.value}</p>
