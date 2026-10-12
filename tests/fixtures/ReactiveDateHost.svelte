<script>
    import { SvelteDate } from 'svelte/reactivity';
    import Child from './ReactiveDateChild.svelte';

    const DAY = 86400000;
    const stamp = new SvelteDate(Date.now() + 14 * DAY);

    export function change() {
        stamp.setTime(stamp.getTime() - 28 * DAY);
    }
</script>

<Child {stamp} />
