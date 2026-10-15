<script>
    // EachRowPairs in Svelte.
    import { count } from './counting.js';

    let rows = $state(Array.from({ length: 5 }, () => ({ n: 0 })));

    const keyed = (row) => {
        count('keys');
        return row;
    };
</script>

{#each [...rows.entries()] as [i, row] (keyed(row))}
    <span>{i}:{row.n}</span>
{/each}
<button class="bump" onclick={() => (rows[2].n += 1)}>bump</button>
<button class="grow" onclick={() => rows.push({ n: 9 })}>grow</button>
