<script>
    import { getContext, setContext } from 'svelte';

    export const publish = () => setContext('k', 1);
    export const read = () => getContext('k');
</script>

<p>late</p>
