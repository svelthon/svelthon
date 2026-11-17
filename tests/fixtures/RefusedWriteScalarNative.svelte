<script>
    let { count } = $props();
    let turn = $state(0);

    function attempt(at) {
        if (at !== 1) return 'idle';
        try {
            count = 5;
            return 'accepted';
        } catch {
            return 'refused';
        }
    }

    const shown = $derived(attempt(turn));

    export const step = () => {
        turn += 1;
    };
    export const retry = () => {
        count = 5;
    };
</script>

<i>{shown}</i>
<p>{count}</p>
