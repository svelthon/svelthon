<script lang="python">
# A snippet of this markup reached by an expression rather than by its name:
# grouped, chosen, and handed back by a factory, and a call grouped whole. The
# call is the last group, and what it is handed is Python.
def pick(first, second):
    return first
</script>

{#snippet first(value)}<p data-k="first">{type(value).__name__}:{value}</p>{/snippet}
{#snippet second(value)}<p data-k="second">{type(value).__name__}:{value}</p>{/snippet}
{@render (first)(1.0)}
{@render (first if True else second)(1.0)}
{@render pick(first, second)(1.0)}
{@render pick(first, second)(True)}
{@render (first(1.0))}
{@render ((first(True)))}
{@render ((first)(1.0))}
