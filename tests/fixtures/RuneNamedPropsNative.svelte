<script>
    // Svelte names the variables otherwise, the props keeping the runes' names.
    let { state: model = $bindable(1), props: two = $bindable(2), host: given = $bindable() } = $props();

    export const step = () => {
        model += 1;
    };
</script>

<output>{model}|{two}|{given}</output>
