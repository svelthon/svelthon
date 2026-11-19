<script>
    // Records no state holds, whose field comes, goes and changes in place,
    // shown again because the count changed: to the optional prop of a Python
    // child and of its twin, the field there at first or not.
    import OptionalPy from './OptionalPy.svelte';
    import OptionalJs from './OptionalJs.svelte';

    const start = (present) => (present ? { ticket: 'A' } : {});
    const records = { present: [start(true), start(true)], absent: [start(false), start(false)] };
    let rev = $state(0);

    export function next() {
        for (const [present, pair] of [[true, records.present], [false, records.absent]]) {
            for (const model of pair) {
                if (rev === 0 && present) model.ticket = undefined;
                else if (rev === 0 || (rev === 1 && present)) model.ticket = 'B';
                else if (rev === 1 || (rev === 2 && present)) delete model.ticket;
                else model.ticket = 'C';
            }
        }

        rev += 1;
    }
</script>

{#each ['present', 'absent'] as first (first)}
    <div data-k="{first}-python"><OptionalPy ticket={records[first][0].ticket} tick={rev} /></div>
    <div data-k="{first}-svelte"><OptionalJs ticket={records[first][1].ticket} tick={rev} /></div>
{/each}
