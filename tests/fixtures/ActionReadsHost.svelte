<script>
    // The parent of ActionPayload and of its Svelte twin, for an `update` that
    // reads a state beside its value: a suffix, changed alone.
    let { Child, events } = $props();
    let suffix = $state('A');
    let value = $state.raw({ n: 0.5 });

    function act(node, initial) {
        events.push(['install', `${initial.n}:${suffix}`]);

        return {
            update(next) {
                events.push(['update', `${next.n}:${suffix}`]);
            },
            destroy() {
                events.push(['destroy']);
            }
        };
    }

    export function rename(to) {
        suffix = to;
    }

    export function bump() {
        value = { n: value.n + 1 };
    }
</script>

<Child {act} {value} />
