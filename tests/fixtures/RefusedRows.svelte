<script lang="python">
# A write the template makes, which Svelte refuses, to the second element of a
# JavaScript array whose first is a getter or a hole.
importjs { makeRows } from "./refused_rows.js"
kind: str = "getter"
rows = makeRows(kind)


def attempt():
    try:
        rows[1] = 99
    except Exception as error:
        return "refused" if "state_unsafe_mutation" in str(error) else str(error)
    return "written"
</script>

<p>{len(rows)}</p>
<output>{attempt()}</output>
