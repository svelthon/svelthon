<script>
    import PropLocalsCount from './PropLocalsCount.svelte';

    const model = { label: 'A' };
    let revision = $state(0);

    export function change(label) {
        model.label = label;
        revision += 1;
    }
</script>

<PropLocalsCount label={model.label} {revision} />
