<script lang="python">
# A cursor the component holds, which writes its index as it advances. Walked
# by the template, the write is one to the component's state while it renders;
# taken into a list by the script first, nothing is written while it renders.
listed: bool = False


class Cursor:
    def __init__(self, items):
        self.items = items
        self.index = 0

    def __iter__(self):
        return self

    def __next__(self):
        if self.index >= len(self.items):
            raise StopIteration
        value = self.items[self.index]
        self.index += 1
        return value


cursor = Cursor(["a", "b"])
rows = list(cursor) if listed else cursor
</script>

{#each rows as item}<p data-k="row">{item}</p>{/each}
