<script lang="python">
class Row:
    def __init__(self):
        self.name = "ok"
        self.size = 7


row = Row()
count = 3
</script>

<p>{f"{row.name=}"}</p>
<p>{f"{row.name = }"}</p>
<p>{f"{row.size=:>4}"}</p>
<p>{f"{row.name=!s}"}</p>
<p>{f"{count=}"}</p>
<p>{f"{count + row.size = }"}</p>
<p>{(lambda: f"{row.name=}")()}</p>
<p>{f"[{row.name=}]"}</p>
