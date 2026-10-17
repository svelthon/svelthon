<script lang="python">
    from javascript import NULL

    # None and JavaScript's null are two values Python tells apart, alone or
    # inside a tuple: two rows of a keyed `{#each}`, two contexts, and a block
    # keyed on one renewed when it holds the other.
    kind: str = "tuple"

    make = {
        "scalar": lambda value: value,
        "tuple": lambda value: (value,),
        "nested": lambda value: ((value,),),
    }[kind]

    rows = [make(None), make(NULL)]

    for at, one in enumerate(rows):
        set_context(one, at)

    found = [get_context(one) for one in rows]
    held = None

    @export
    def model():
        return [rows[0] == rows[1], found]

    @export
    def change():
        global held
        held = NULL
</script>

{#each rows as row, at (row)}<output>{at}</output>{/each}
{#key make(held)}<input value="draft" />{/key}
