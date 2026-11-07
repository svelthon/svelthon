<script>
    // Svelte's witness for ActionDictLive.svelte.
    import { acquire } from './action_resources.js';

    let value = $state(0);

    function act(node, given) {
        let close = acquire(given);
        const payload = { destroy: close };

        payload.update = (next) => {
            close();
            close = acquire(next);
            payload.destroy = close;
        };
        return payload;
    }

    export function bump() {
        value += 1;
    }
</script>

<p use:act={value}>{value}</p>
