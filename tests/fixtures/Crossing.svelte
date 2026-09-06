<script module>
    import CrossChild from './CrossChild.svelte';
</script>

<script lang="python">
# One dict, asked about wherever it can travel: made here, handed to another
# module's function, read back out of that module, returned by it, and passed
# down as a component prop.
import keeper

record = {"k": "v"}
nested = {"rows": [1, 2]}

keeper.keep(record)
keeper.keep(nested)

taken = keeper.table
given = keeper.give()


def describe(value):
    return "{} dict={}".format(type(value).__name__, isinstance(value, dict))
</script>

<p data-k="module">{type(keeper).__name__} / {type(keeper.keep).__name__}</p>
<p data-k="local">{describe(record)}</p>
<p data-k="argument">{keeper.seen}</p>
<p data-k="read">{describe(taken)}</p>
<p data-k="returned">{describe(given)}</p>
<p data-k="nested">{describe(nested["rows"])}</p>
<CrossChild one={record} />
