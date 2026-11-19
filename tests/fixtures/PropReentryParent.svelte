<script>
    import PropReentryChild from './PropReentryChild.svelte';
    import PropReentryBound from './PropReentryBound.svelte';

    let value = $state(1);
    let bound = $state(1);
    let child, twin;

    export function own() {
        child.own();
        twin.own();
    }

    export function replace(next) {
        value = next;
        bound = next;
    }
</script>

<PropReentryChild bind:this={child} {value} />
<PropReentryBound bind:this={twin} bind:value={bound} />
