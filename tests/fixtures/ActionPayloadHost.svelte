<script>
    // The parent of ActionPayload and of its Svelte twin: an action whose
    // result has getters, `update` turned on by a state, and `destroy`.
    let { Child, events } = $props();
    let enabled = $state(false);
    let value = $state(0.5);
    let serial = 0;

    function act(node, initial) {
        const id = ++serial;
        const update = (next) => events.push(['update', id, next]);
        const destroy = () => events.push(['destroy', id]);

        events.push(['install', id, initial]);

        return {
            get update() {
                return enabled ? update : undefined;
            },
            get destroy() {
                events.push(['read destroy', id, enabled]);
                return destroy;
            }
        };
    }

    export function enable() {
        enabled = true;
    }

    export function disable() {
        enabled = false;
    }

    export function bump() {
        value += 1;
    }
</script>

<Child {act} {value} />
