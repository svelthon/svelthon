<script lang="python">
# A parent with no root and no pre effect, which passes a name of its own to a
# child whose cleanup may run before the first flush.
importjs Child from "./EarlyPropChild.svelte"
capture: object
count = 7
</script>

<Child n={count} {capture} />
