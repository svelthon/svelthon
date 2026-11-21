<script module>
    // A function of the author's, named like Svelthon's inspect(), called on a
    // line of its own.
    let seen = '';
    const inspect = (value) => (seen = `${typeof value}:${value}`);
    const read = () => seen;
</script>

<script lang="python">
    inspect(7)
</script>

<output>{read()}</output>
