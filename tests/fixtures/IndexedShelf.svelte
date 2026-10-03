<script lang="python">
# A list subclass whose `__getitem__` hands out a child its storage does not
# hold, kept on the class so that nothing but the list leads to it: what an
# index shows is what indexing it gives, emptied or not.
class Box:
    def __init__(self):
        self.value = 0

class Shelf(list):
    def __getitem__(self, index):
        return Shelf.kept

Shelf.kept = Box()

rows = Shelf([Box()])

@export
def detach():
    rows.clear()

@export
def mutate():
    Shelf.kept.value += 1
</script>

<p>{rows[0].value}</p>
