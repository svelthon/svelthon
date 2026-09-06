<script module>
    import CrossChild from './CrossChild.svelte';
</script>

<script lang="python">
# One container of each kind, asked about wherever it can travel: made here,
# handed to another module's function, read back out of that module, returned by
# it, and passed down as a component prop.
import keeper

record = {"k": "v"}
rows = [1, 2]
tags = {"a", "b"}

nested = {"rows": [1, 2]}

keeper.looks(nested)


def describe(value):
    # The module keeps its own copy of this on purpose: measuring a value that
    # never left has to stay on this side of the boundary being measured.
    return "{} len={}".format(type(value).__name__, len(value))
</script>

<p data-k="module">{type(keeper).__name__} / {type(keeper.looks).__name__}</p>

<p data-k="dict-local">{describe(record)}</p>
<p data-k="dict-argument">{keeper.looks(record)}</p>
<p data-k="dict-read">{describe(keeper.table)}</p>
<p data-k="dict-returned">{describe(keeper.give("dict"))}</p>

<p data-k="list-local">{describe(rows)}</p>
<p data-k="list-argument">{keeper.looks(rows)}</p>
<p data-k="list-read">{describe(keeper.rows)}</p>
<p data-k="list-returned">{describe(keeper.give("list"))}</p>

<p data-k="set-local">{describe(tags)}</p>
<p data-k="set-argument">{keeper.looks(tags)}</p>
<p data-k="set-read">{describe(keeper.tags)}</p>
<p data-k="set-returned">{describe(keeper.give("set"))}</p>

<p data-k="nested">{describe(nested["rows"])}</p>

<CrossChild one={record} two={rows} three={tags} />
