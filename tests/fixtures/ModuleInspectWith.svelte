<script module>
    // A function of the author's, named like Svelthon's inspect_with(), called
    // on a line of its own with its values unpacked.
    let seen = '';
    const inspect_with = (...values) => (seen = values.map((value) => `${typeof value}:${value}`).join(','));
    const read = () => seen;
</script>

<script lang="python">
    inspect_with(*[7])
</script>

<output>{read()}</output>
