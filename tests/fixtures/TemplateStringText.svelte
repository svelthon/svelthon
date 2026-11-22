<script lang="python">
class Row:
    name = "Ada"


row = Row()
record = {"name": "Grace"}
x = 3


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
<p data-k="triple">{show(t"""{x}""")}</p>
<p data-k="lined">{show(t"""a
{x}""")}</p>
<p data-k="texted">{show(t"x: {row.name=}")}</p>
<p data-k="twice">{show(t"{row.name=} and {record.name=}")}</p>
<p data-k="joined">{show(t"a{row.name=}" t"b{record.name}")}</p>
<p data-k="escaped">{show(t"\N{BULLET} {row.name=}")}</p>
