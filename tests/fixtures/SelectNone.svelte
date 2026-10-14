<script lang="python">
# A multiple select whose model holds None, or something else, and an option
# whose value is None.
held: str = "none"

picked = [None] if held == "none" else [1]


@export
def chosen():
    return [one is None for one in picked]
</script>

<select multiple bind:value={picked}><option value={None}>none</option><option value={1}>one</option></select>
