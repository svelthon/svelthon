<script>
    // The witness of `SpreadEntries.svelte` for the rest of a JavaScript row.
    import { rows } from './rest_symbols.js';
    import SpreadKeysChild from './SpreadKeysChild.svelte';
</script>

{#each rows as { first: selected, ...rest }}
    <SpreadKeysChild {...rest} />
{/each}
