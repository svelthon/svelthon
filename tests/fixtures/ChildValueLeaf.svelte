<script>
    // What a component written in JavaScript receives: JavaScript's scalars, a
    // NaN told apart.
    let { value = $bindable(), other } = $props();

    const seen = (one) => (typeof one === 'number' && Number.isNaN(one) ? 'NaN' : typeof one);
</script>

<p>{seen(value)}|{seen(other)}</p>
