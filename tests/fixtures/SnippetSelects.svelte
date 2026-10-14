<script lang="python">
# One snippet holding a select a spread makes multiple or leaves single,
# rendered twice over one list, in either order.
first: str = "multiple"

original = [None]
picked = original
many = {"multiple": True}
one = {"multiple": False}


@export
def model():
    return [type(picked).__name__, picked is original]
</script>

{#snippet choice(attrs, k)}
    <select data-k={k} {**attrs} bind:value={picked}>
        {#if k == "multiple"}<option value={None}>none</option><option value={0.5}>half</option>
        {:else}<option value={original}>list</option><option value={None}>none</option>{/if}
    </select>
{/snippet}

{#if first == "multiple"}{@render choice(many, "multiple")}{@render choice(one, "single")}
{:else}{@render choice(one, "single")}{@render choice(many, "multiple")}{/if}
