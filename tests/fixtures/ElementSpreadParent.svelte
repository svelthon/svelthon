<script>
    // A record no state holds, changed in place, then the children rendered
    // again because the count changed.
    import ElementSpreadPy from './ElementSpreadPy.svelte';
    import ElementSpreadJs from './ElementSpreadJs.svelte';

    const record = { title: 'r1', locked: false };
    const calls = { python: 0, svelte: 0 };
    let count = $state(0);

    export function change() {
        record.title = 'r2';
        record.locked = true;
        count += 1;
    }

    export function made() {
        return [calls.python, calls.svelte];
    }
</script>

<div data-k="python"><ElementSpreadPy {record} {count} tally={() => calls.python++} /></div>
<div data-k="svelte"><ElementSpreadJs {record} {count} tally={() => calls.svelte++} /></div>
