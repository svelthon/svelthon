<script lang="python">
# Three selects over one set of options: a multiple one, and a single one bound
# in each spelling. The options are floats, ints or dicts holding a float.
kind: str = "float"

def make():
    if kind == "float":
        return [0.25, 0.5]
    if kind == "int":
        return [1, 2]
    return [{"id": 0.25}, {"id": 0.5}]

values = make()
picked = [values[0]]
value = values[0]

@export
def second():
    global picked, value
    picked = [values[1]]
    value = values[1]

# Which options the model holds, by identity, and whether each kept its type.
@export
def held():
    many = [i for i, one in enumerate(values) if any(one is x or (kind != "dict" and one == x) for x in picked)]
    single = [i for i, one in enumerate(values) if one is value or (kind != "dict" and one == value)]
    typed = all(type(x) is type(values[0]) for x in picked + [value])
    return tojson([many, single, typed])
</script>

<select data-k="many" multiple bind:value={picked}>
    {#each values as one}<option value={one}>{one}</option>{/each}
</select>
<select data-k="after" bind:value={picked} multiple>
    {#each values as one}<option value={one}>{one}</option>{/each}
</select>
<select data-k="long" bind:value={value}>
    {#each values as one}<option value={one}>{one}</option>{/each}
</select>
<select data-k="short" bind:value>
    {#each values as one}<option value={one}>{one}</option>{/each}
</select>
