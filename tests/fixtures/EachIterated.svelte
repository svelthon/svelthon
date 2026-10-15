<script lang="python">
# A JavaScript array whose iteration is its own, walked by the template, or by
# Python's `for` for the witness.
importjs { makeRows } from "./stateful_rows.js"
kind: str = "own"
rows = makeRows(kind)


@export
def walked_by_python():
    shown = []
    for row in makeRows(kind):
        shown.append(str(row))
    return " ".join(shown)
</script>

{#each rows as row}<span>{row}</span>{/each}
