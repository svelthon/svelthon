<script>
    // EachMadePairs in Svelte.
    import { count } from './counting.js';

    let { kind = 'sorted' } = $props();

    const d = $state(Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`k${i}`, [i]])));
    const rows = $state(Array.from({ length: 5 }, (_, i) => [i]));

    const pairs = () =>
        kind === 'sorted'
            ? Object.entries(d).sort(([a], [b]) => (a < b ? -1 : 1))
            : kind === 'enumerated'
              ? [...rows.entries()]
              : Object.entries(d).reverse();

    const size = (v) => {
        count('rows');
        return v.length;
    };

    const grow = () => {
        d.k2.push(1);
        rows[2].push(1);
    };
</script>

{#each pairs() as [k, v] (k)}<span>{size(v)}</span>{/each}
<button class="grow" onclick={grow}>grow</button>
