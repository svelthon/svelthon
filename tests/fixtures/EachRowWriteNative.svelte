<script>
    // EachRowWrite in Svelte.
    import { untrack } from 'svelte';
    import { count } from './counting.js';

    let { n = 0 } = $props();
    let rows = $state(untrack(() => Array.from({ length: n }, () => ({ choice: undefined }))));

    const keyed = (row) => {
        count('keys');
        return row;
    };

    const read = (row) => {
        count('rows');
        return row.choice === undefined ? '' : String(row.choice);
    };
</script>

{#each rows as row (keyed(row))}
    <select bind:value={row.choice}>
        {#each [0, 1, 2] as c}
            <option value={c}>{c}</option>
        {/each}
    </select>
    <span>{read(row)}</span>
{/each}
