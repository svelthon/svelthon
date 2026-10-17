<script lang="python">
# Two props a JavaScript parent fills with a fractional number, or with null.
import javascript

amount: float = 0.42
two_way: float = bindable(0.42)
</script>
<p data-k="amount">{"null" if amount is javascript.NULL else round(amount, 1)}</p>
<p data-k="two-way">{round(two_way, 1)}</p>
<p data-k="absent">{amount is javascript.NULL}</p>
