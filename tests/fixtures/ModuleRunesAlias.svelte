<script module>
    // A rune name the module binds, beside a function that declares the name
    // it was held under.
    const state = 'module';

    export function status() {
        const __svelthon_state = 'local';
        return state + ':' + __svelthon_state;
    }
</script>

<script lang="python">
count = 0
</script>

<p>{status()}</p>
