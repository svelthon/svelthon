<script module>
    // A rune name the module binds, beside a function that declares the name
    // it was held under.
    const state = 'module';

    export function status() {
        const __brycomp_svelthon_state = 'local';
        return state + ':' + __brycomp_svelthon_state;
    }
</script>

<script lang="python">
count = 0
</script>

<p>{status()}</p>
