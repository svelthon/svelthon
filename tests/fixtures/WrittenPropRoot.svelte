<script>
    // Records no state holds, changed in place, then shown again because the
    // count changed: to a Python child that writes its prop and to its twin.
    import WrittenPropPy from './WrittenPropPy.svelte';
    import WrittenPropJs from './WrittenPropJs.svelte';
    import WrittenPropGlobals from './WrittenPropGlobals.svelte';
    import WrittenPropGlobalsKey from './WrittenPropGlobalsKey.svelte';

    const records = [{ ticket: 't1' }, { ticket: 't1' }, { ticket: 't1' }, { ticket: 't1' }];
    let rev = $state(0);

    export function change(n) {
        for (const one of records) one.ticket = 't' + n;
        rev += 1;
    }
</script>

<div data-k="python"><WrittenPropPy ticket={records[0].ticket} whole={records[0]} {rev} /></div>
<div data-k="svelte"><WrittenPropJs ticket={records[1].ticket} whole={records[1]} {rev} /></div>
<div data-k="named"><WrittenPropGlobals ticket={records[2].ticket} whole={records[2]} {rev} /></div>
<div data-k="computed"><WrittenPropGlobalsKey ticket={records[3].ticket} whole={records[3]} {rev} /></div>
