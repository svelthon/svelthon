<script lang="python">
rows = [{"n": 1}]
record = {"nested": {"n": 1}}


@export
def values():
    return {"rows": rows, "record": record}


@export
def read_back():
    # The last row and the nested record as Python reads them, by a dict's API.
    return " ".join(f"{type(one).__name__}:{one.get('n') if isinstance(one, dict) else '-'}"
                    for one in (rows[-1], record["nested"]))
</script>

<output data-k="rows">{rows[-1]["n"]}</output>
<output data-k="record">{record["nested"]["n"]}</output>
