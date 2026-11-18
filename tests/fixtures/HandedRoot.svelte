<script>
    // A record no state holds, changed in place, then everything rendered again
    // because the count changed: through a Python forwarder and a Svelte one.
    import HandedPy from './HandedPy.svelte';
    import HandedJs from './HandedJs.svelte';

    const record = (id) => ({
        name: id,
        href: `/record/${id}`,
        color: id === 'A' ? 'red' : 'blue',
        links: { href: `/record/${id}`, name: id }
    });
    const active = record('A');
    const rows = [active];
    let tick = $state(0);

    export function next() {
        Object.assign(active, record('B'));
        tick += 1;
    }
</script>

<div data-k="python"><HandedPy obj={active} {rows} {tick} /></div>
<div data-k="svelte"><HandedJs obj={active} {rows} {tick} /></div>
