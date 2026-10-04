<script lang="python">
price = get_context("price")
whole = get_context("whole")
label = get_context("label")
</script>

<p data-k="python">{type(price).__name__}|{price.currency}|{type(whole).__name__}|{whole}|{type(label).__name__}|{label.shout()}</p>
