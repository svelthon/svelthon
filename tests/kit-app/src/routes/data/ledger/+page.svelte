<script>
    import { Ledger } from '#lib/ledger.js';

    let { data } = $props();

    const read = ({ ledger, table }) =>
        [
            ledger instanceof Ledger ? ledger.label() : `a ${ledger.constructor.name}`,
            Object.getPrototypeOf(table) === null ? 'no prototype' : 'a prototype',
            ledger.get('a') === table.a && ledger.get('b') === table.a && table.whole.a === table.a ? 'one list' : 'copies'
        ].join(', ');
</script>

<p data-k="value">{read(data)}</p>
