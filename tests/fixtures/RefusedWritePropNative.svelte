<script>
    let { items } = $props();
    let own = $state([5, 5]);
    let second = $state([9, 9, 9, 9]);
    let turn = $state(0);

    function attempt(at) {
        if (at !== 1) return 'idle';
        try {
            items = second;
            return 'accepted';
        } catch {
            return 'refused';
        }
    }

    const shown = $derived(attempt(turn));

    export const override = () => {
        items = own;
    };
    export const step = () => {
        turn += 1;
    };
    export const grow = () => {
        own.push(1);
    };
    export const retry = () => {
        items = second;
    };
</script>

<i>{shown}</i>
<p>{items.length}</p>
