<script>
    let { value = $bindable('x') } = $props();

    export const clear = () => {
        value = null;
    };
</script>

<p data-k="child">{value === null}</p>
