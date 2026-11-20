<script module>
    // What nothing follows, read by the key.
    const external = { version: 0 };
</script>

<script lang="python">
# Rows handed anew, the same row in them, or the same rows computed again,
# under a key that reads a JavaScript object's field, changed before: each walk
# is a new row.
kind: str = "list"
rows = [{"id": 1}]
revision = 0


def current(_revision):
    return rows


@export
def step():
    global rows, revision
    external.version += 1
    if kind == "same":
        revision += 1
    else:
        rows = list(rows) if kind == "list" else [*rows] if kind == "star" else tuple(rows)
</script>

{#each current(revision) as row (str(row["id"]) + ":" + str(external.version))}<input value="draft" />{/each}
