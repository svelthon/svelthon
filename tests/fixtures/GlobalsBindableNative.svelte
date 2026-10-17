<script>
    // The witness: a Svelte component binding `Object` beside a bindable prop.
    let Object = 1;
    let { value = $bindable(7) } = $props();

    export function change(n) {
        value = n;
    }
</script>

<output>{value}</output>
