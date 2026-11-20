<script lang="python">
# Rows a JavaScript module holds, keyed by a getter that counts its reads, the
# same list computed again at each revision.
importjs { rows } from "./key-reads.js"
revision = 0


def current(_revision):
    return rows


@export
def step():
    global revision
    revision += 1
</script>

{#each current(revision) as row (row.id)}<input value="draft" />{/each}
