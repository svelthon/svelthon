<script>
    // The same set in Svelte: the witness for BigIntMember.
    import { SvelteSet } from 'svelte/reactivity';

    const flags = new SvelteSet([2n ** 70n]);

    function read() {
        flags.add(2n ** 70n);

        return flags.size;
    }
</script>

<output>{read()}</output>
