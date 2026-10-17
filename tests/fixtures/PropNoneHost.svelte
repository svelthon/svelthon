<script lang="python">
# A Python parent passing None, and javascript.NULL, to a Python child whose
# prop has a default, by name and in a spread.
import javascript
importjs Child from "./PropWriteKindsChild.svelte"

given = {"value": None}
given_null = {"value": javascript.NULL}
</script>

<div data-k="name"><Child value={None} /></div>
<div data-k="spread"><Child {**given} /></div>
<div data-k="name-null"><Child value={javascript.NULL} /></div>
<div data-k="spread-null"><Child {**given_null} /></div>
