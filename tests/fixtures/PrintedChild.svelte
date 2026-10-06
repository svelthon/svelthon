<script>
    let { price, plain } = $props();
</script>

<p data-k="price">{price}</p>
<p data-k="literal">{`${price}`}</p>
<p data-k="plain">{plain}</p>
