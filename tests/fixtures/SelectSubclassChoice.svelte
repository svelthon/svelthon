<script lang="python">
# Two options of the same text: an instance of a subclass, and the plain value
# the model holds.
kind: str = "price"
many: bool = False


class Price(float):
    pass


class Count(int):
    pass


class Label(str):
    pass


special = {"price": Price, "count": Count, "label": Label}[kind]({"price": 0.5, "count": 1, "label": "yes"}[kind])
plain = {"price": 0.5, "count": 1, "label": "yes"}[kind]
picked = [plain] if many else plain


@export
def chosen():
    one = picked[0] if many else picked
    return type(one).__name__
</script>

{#if many}<select multiple bind:value={picked}><option value={special}>special</option><option value={plain}>plain</option></select>
{:else}<select bind:value={picked}><option value={special}>special</option><option value={plain}>plain</option></select>{/if}
