<script lang="python">
# A Python parent passing None to a Python child whose prop has a default, by
# name and in a spread.
importjs Child from "./PropWriteKindsChild.svelte"

given = {"value": None}
</script>

<div data-k="name"><Child value={None} /></div>
<div data-k="spread"><Child {**given} /></div>
