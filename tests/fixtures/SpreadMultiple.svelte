<script lang="python">
# A select made multiple by a spread, or by its own attribute, whose model holds
# None or a number.
held: str = "none"
spread: bool = True

attrs = {"multiple": True}
picked = [None] if held == "none" else [0.5]


@export
def model():
    return type(picked).__name__
</script>

{#if spread}<select {**attrs} bind:value={picked}><option value={None}>none</option><option value={0.5}>half</option></select>
{:else}<select multiple bind:value={picked}><option value={None}>none</option><option value={0.5}>half</option></select>{/if}
