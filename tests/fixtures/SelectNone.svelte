<script lang="python">
# A multiple select whose model holds None, JavaScript's null, or something
# else, and an option whose value is each of the first two.
from javascript import NULL

held: str = "none"

picked = [None] if held == "none" else [NULL] if held == "null" else [1]


@export
def chosen():
    return [[one is None, one is NULL] for one in picked]
</script>

<select multiple bind:value={picked}><option value={None}>none</option><option value={NULL}>null</option><option value={1}>one</option></select>
