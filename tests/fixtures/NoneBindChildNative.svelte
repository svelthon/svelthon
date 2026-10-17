<script>
    let { value = $bindable('x') } = $props();

    export const clear = () => {
        value = undefined;
    };
</script>

<p data-k="child">{value === undefined}</p>
