<script>
    import ConditionalLifecycle from './ConditionalLifecycle.svelte';

    let { enabled = false, log } = $props();
    let label = $state('first');

    export const relabel = (text) => (label = text);
</script>

<ConditionalLifecycle {enabled} {label} {log} />
