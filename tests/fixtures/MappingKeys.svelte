<script lang="python">
# A dict whose key is a number, handed to a JavaScript child as a prop.
importjs MappingKeysChild from './MappingKeysChild.svelte'

payload = {7: 42}
</script>

<MappingKeysChild data={payload} />
