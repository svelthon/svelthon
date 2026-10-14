<script lang="python">
# A JavaScript array grouped by `batch`, holding as data a `slice` or a
# constructor of its own.
importjs { grouped } from "./shadowed_arrays.js"

kind: str = "null"

rows = grouped(kind)
</script>

<output>{batch(rows, 2)} {batch(rows, 2, 0)}</output>
