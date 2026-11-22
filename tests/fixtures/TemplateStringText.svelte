<script lang="python">
class Row:
    name = "Ada"


row = Row()
record = {"name": "Grace"}


def show(t):
    parts = [(one.expression, one.value, one.conversion, one.format_spec) for one in t.interpolations]
    return f"{t.strings!r}|{parts!r}"
</script>

<p data-k="debug">{show(t"{row.name=}")}</p>
<p data-k="plain">{show(t"a {row.name} b")}</p>
<p data-k="key">{show(t"{record.name}")}</p>
<p data-k="spaced">{show(t"{ row.name = }")}</p>
<p data-k="converted">{show(t"{row.name=!s}")}</p>
<p data-k="formatted">{show(t"{row.name=:>5}")}</p>
<p data-k="nested">{show(t"{row.name:>{len(record.name)}}")}</p>
