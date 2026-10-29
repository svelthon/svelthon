<script lang="python">
# A parent with no root and no pre effect, which hands a literal to a child
# written in JavaScript whose cleanup may run before the first flush.
importjs Child from "./EarlyJsChild.svelte"
capture: object
</script>

<Child n={7} {capture} />
