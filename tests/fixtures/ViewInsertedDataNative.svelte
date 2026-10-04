<script>
    let rows = $state([{ n: 1 }]);
    let record = $state({ nested: { n: 1 } });

    export function values() {
        return { rows, record };
    }
</script>

<output data-k="rows">{rows.at(-1).n}</output>
<output data-k="record">{record.nested.n}</output>
