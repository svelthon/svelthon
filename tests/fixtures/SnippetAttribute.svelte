<script lang="python">
# Snippets held under an attribute and a key, rendered by that path: read as
# Python reads an attribute, not as a JavaScript property.
importjs {createRawSnippet} from "svelte"


class Holder:
    def __init__(self, fn):
        self.fn = fn


def make():
    return {"render": lambda: '<p data-k="raw">ok</p>'}


holder = Holder(createRawSnippet(make))
bundle = {"fn": holder.fn}
missing = Holder(None)
</script>

{#snippet row(value)}<p data-k="own">{type(value).__name__}:{value}</p>{/snippet}
{held = Holder(row)}
{@render holder.fn()}
{@render holder.fn?.()}
{@render bundle["fn"]()}
{@render missing.fn?.()}
{@render held.fn(1.0)}
