<script module>
    // What nothing follows, read by the key.
    const external = { version: 0 };
</script>

<script lang="python">
# Rows handed anew, the same row in them, under a key that reads a JavaScript
# object's field, changed before: each walk is a new row.
kind: str = "list"
rows = [{"id": 1}]


@export
def step():
    global rows
    external.version += 1
    rows = list(rows) if kind == "list" else [*rows] if kind == "star" else tuple(rows)
</script>

{#each rows as row (str(row["id"]) + ":" + str(external.version))}<input value="draft" />{/each}
