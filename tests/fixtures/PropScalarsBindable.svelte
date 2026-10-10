<script lang="python">
price: float = bindable()
whole: float = bindable()
label: str = bindable()
online: float = bindable()
</script>

<p data-k="python">{type(price).__name__}|{price.currency}|{type(whole).__name__}|{whole}|{type(label).__name__}|{label.shout()}|{type(online).__name__}|{online}</p>
