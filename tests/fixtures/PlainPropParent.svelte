<script>
    // An object no state holds, changed in place, then the children rendered
    // again because the count changed.
    import PlainPropPy from './PlainPropPy.svelte';
    import PlainPropJs from './PlainPropJs.svelte';

    const plain = { name: 'a' };
    let count = $state(0);

    export function change() {
        plain.name = 'b';
        count += 1;
    }
</script>

<div data-k="python"><PlainPropPy obj={plain} {count} /></div>
<div data-k="svelte"><PlainPropJs obj={plain} {count} /></div>
