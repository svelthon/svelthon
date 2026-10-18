<script lang="python">
# A Python parent handing EachComputedRows the dict its rows are computed from.
importjs EachComputedRows from "./EachComputedRows.svelte"
shared = {f"k{i}": [i] for i in range(5)}
</script>

<EachComputedRows kind="prop" given={shared} />
