<script lang="python">
# The inline form, mounted: what the markup pass produces has to reach the DOM.
a = 0
b = 0
c = 0
</script>

<button data-k="two" onclick={lambda: (a := 1, b := 2)}>two</button>
<button data-k="three" onclick={lambda: (a := 7, b := 8, c := 9)}>three</button>
<p data-k="a">{a}</p>
<p data-k="b">{b}</p>
<p data-k="c">{c}</p>
