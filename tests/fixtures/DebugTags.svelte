<script lang="python">
# What `{@debug}` logs: a list and a dict changed in place, a number assigned,
# a derived, and a name Python reads under another spelling (`ﬁeld` is
# `field`); and where it stands, between words and at the end of an element;
# and names grouped or given twice, as Svelte reads them.
rows = []
record = {"n": 0}
count = 0
ﬁeld = 1


@derived
def total():
    return len(rows)


@export
def change():
    global count, ﬁeld
    rows.append(1)
    record["n"] = 1
    count = 1
    ﬁeld = 2
</script>

{@debug rows}
{@debug record}
{@debug count, total}
<output>{len(rows)}|{record["n"]}|{count}|{total}|{ﬁeld}</output>
<p>a {@debug ﬁeld} b</p>
<p>c {@debug count}</p>
<p>d {@debug (rows)} {@debug (ﬁeld)} {@debug count, count} {@debug ((record), (total))}</p>
