<script module>
    // A rune name the module binds, tested by a `switch` whose case binds it
    // again: the test reads the module's.
    export const state = { kind: 'ready' };

    export function show() {
        switch (state.kind) {
            case 'ready':
                const state = 'local';
                return 'ready:' + state;
        }
    }
</script>

<script lang="python">
count = 0
</script>

<p>{show()}</p>
