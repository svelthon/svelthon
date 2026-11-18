<script>
    // A record no state holds, its fields changed and its action replaced in
    // place, then the children rendered again because the count changed.
    import RecordPy from './RecordPy.svelte';
    import RecordJs from './RecordJs.svelte';

    const entry = { id: 'A', url: '/record/A', action: { disabled: false, 'aria-label': 'Save A' } };
    const rows = [entry];
    let tick = $state(0);

    export function next() {
        entry.id = 'B';
        entry.url = '/record/B';
        entry.action = { disabled: true, 'aria-label': 'Save B' };
        tick += 1;
    }
</script>

<div data-k="python"><RecordPy {entry} {rows} {tick} /></div>
<div data-k="svelte"><RecordJs {entry} {rows} {tick} /></div>
