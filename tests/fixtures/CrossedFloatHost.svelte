<script>
    // A JavaScript parent binding the child's value and formatting it as a
    // number.
    let { Child } = $props();
    let value = $state(0.25);
    let child;

    const shown = (one) => {
        try {
            return `${typeof one}:${one.toFixed(2)}`;
        } catch (error) {
            return `${typeof one}:${error.message}`;
        }
    };

    export const half = () => child.half();
    export const whole = () => child.whole();
</script>

<Child bind:value bind:this={child} />
<p data-k="parent">{shown(value)}</p>
