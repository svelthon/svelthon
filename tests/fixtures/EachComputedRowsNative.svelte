<script>
    // EachComputedRows in Svelte: the same rows, computed the same ways.
    import { count } from './counting.js';

    let { kind = 'sorted' } = $props();

    const d = $state(Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, [i]])));
    const rows = $state(Array.from({ length: 5 }, (_, i) => ({ n: i })));

    const computed = () => {
        count('rows');
        if (kind === 'sorted' || kind === 'prop') return Object.entries(d).sort(([a], [b]) => (a < b ? -1 : 1));
        if (kind === 'items') return Object.entries(d);
        if (kind === 'enumerate') return [...rows.entries()];
        return rows.map((row) => row);
    };

    const grow = () => {
        d.k2.push(9);
        rows[2].n += 1;
    };

    const add = () => {
        d.k5 = [5];
        rows.push({ n: 5 });
    };
</script>

{#each computed() as row}<span>{row}</span>{/each}
<button class="grow" onclick={grow}>grow</button>
<button class="add" onclick={add}>add</button>
