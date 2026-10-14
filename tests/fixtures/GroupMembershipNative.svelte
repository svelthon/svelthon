<script>
    // The same selections in Svelte, whose group asks the array `includes`:
    // the witness for GroupMembership.
    let { rule = 'fold' } = $props();

    class Selection extends Array {
        includes(value) {
            if (rule === 'always') return true;
            if (rule === 'never') return false;

            return Array.from(this).some((one) => String(one).toLowerCase() === String(value).toLowerCase());
        }
    }

    // Read once, at init, as the Python script reads its names.
    const initial = () => {
        const held = { fold: ['YES'], always: [], never: ['yes'], plain: ['yes'] }[rule];

        return rule === 'plain' ? held : Selection.from(held);
    };

    let picked = $state(initial());
</script>

<input type="checkbox" value="yes" bind:group={picked} />
