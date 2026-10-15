<script lang="python">
# A JavaScript array whose element is a getter, held by the component, whose
# template reads its length alone.
importjs { makeRows } from "./getter_rows.js"
kind: str = "counting"
rows = makeRows(kind)
</script>

<output>{len(rows)}</output>
