<script lang="python">
# `bind:this` on an element of an `{#each}`, its target read off the row, a
# dict's and an instance's. The witness is `BindThisInEachNative.svelte`.
class Holder:
    def __init__(self, name):
        self.name = name
        self.ref = None


rows = [{"name": "a", "ref": None}, {"name": "b", "ref": None}]
held = [Holder("c"), Holder("d")]


@export
def bound():
    return [row["ref"].dataset.k for row in rows] + [one.ref.dataset.k for one in held]
</script>

{#each rows as row (row["name"])}<div data-k={row["name"]} bind:this={row["ref"]}></div>{/each}
{#each held as one (one.name)}<input data-k={one.name} bind:this={one.ref} />{/each}
