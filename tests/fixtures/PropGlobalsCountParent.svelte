<script>
    import PropGlobalsCount from './PropGlobalsCount.svelte';

    const model = { label: 'A' };
    let revision = $state(0);

    export function change(label) {
        model.label = label;
        revision += 1;
    }
</script>

<PropGlobalsCount label={model.label} {revision} />
