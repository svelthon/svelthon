<script>
    // A JavaScript parent of PropFloatDefault, passing what a test asks of it,
    // or the props it was given until then.
    import PropFloatDefault from './PropFloatDefault.svelte';

    let { scale = undefined, ratio = undefined } = $props();
    let changed = $state(null);
    const given = $derived(changed ?? { scale, ratio });
    let child;

    export function give(values) {
        changed = { ...given, ...values };
    }

    export function write(value) {
        child.write(value);
    }

    export function model() {
        return child.model();
    }
</script>

<PropFloatDefault bind:this={child} scale={given.scale} ratio={given.ratio} />
