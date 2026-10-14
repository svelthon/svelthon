<script>
    // The same write in Svelte, to a `$state` field the first paragraph reads:
    // the witness for ClassWriteWhileRendering.
    const fields = $state({ label: 'a' });

    function calculate() {
        fields.label = 'b';

        return fields.label;
    }
</script>

<p>{fields.label}</p>
<p>{calculate()}</p>
