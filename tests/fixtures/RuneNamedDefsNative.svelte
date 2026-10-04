<script>
    let { label = 'rows' } = $props();

    // `state` can be declared here only because this script never uses
    // `$state`, and `props` cannot be, `$props()` being called above.
    export function state() {
        return 42;
    }

    function readProps() {
        return 1;
    }
</script>

<p>{label} {state()} {readProps()}</p>
