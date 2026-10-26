<script lang="python">
# Keyed `{#each}` over patterns whose default waits for a row unpacked by key
# or around a star: the key reads the names the default binds, as the block
# does. An explicit `NULL` is a value, and no default stands in for it.
import javascript

rows = [[{"first": 3}], [{"first": 4}, 9], [{"first": 5}], [{"first": 6}, javascript.NULL]]
nested = [[{"first": 3}]]
starred = [[[3, 4, 5]]]


@export
def reorder():
    global rows
    rows = [rows[1], rows[0], rows[3], rows[2], [{"first": 7}]]
</script>

{#each rows as [{first}, second=first] (second)}
    <output data-k="pairs">{first}:{second}</output>
{/each}
{#each nested as [{first}, [inner]=[first + 1]] (inner)}
    <output data-k="pattern">{first}:{inner}</output>
{/each}
{#each nested as [{first}, {deep}={"deep": first * 2}] (deep)}
    <output data-k="braces">{first}:{deep}</output>
{/each}
{#each starred as [[first, *rest], second=first] (second)}
    <output data-k="starred">{first}:{len(rest)}:{second}</output>
{/each}
