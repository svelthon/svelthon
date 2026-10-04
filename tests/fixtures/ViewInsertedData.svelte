<script lang="python">
rows = [{"n": 1}]
record = {"nested": {"n": 1}}


@export
def values():
    return {"rows": rows, "record": record}
</script>

<output data-k="rows">{rows[-1]["n"]}</output>
<output data-k="record">{record["nested"]["n"]}</output>
