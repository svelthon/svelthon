<script lang="python">
# Two props a JavaScript parent fills with a fractional number.
amount: float = 0.42
two_way: float = bindable(0.42)
</script>
<p data-k="amount">{"none" if amount is None else round(amount, 1)}</p>
<p data-k="two-way">{round(two_way, 1)}</p>
<p data-k="absent">{amount is None}</p>
