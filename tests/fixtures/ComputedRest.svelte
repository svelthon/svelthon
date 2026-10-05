<script module>
    import { key } from './computed_rest_keys.js';
</script>

<script lang="python">
# A row unpacked by a computed key and the rest: the key read is the key left
# out. The witness is `ComputedRestNative.svelte`.
rows = [{"first": 1, "second": 2, "third": 3}]
</script>

{#each rows as {[key()]: selected, ...rest}}
    <p data-k="selected">{selected}</p>
    <p data-k="rest">{",".join(rest)}</p>
{/each}
