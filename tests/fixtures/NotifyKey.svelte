<script lang="python">
# `$notify` was the name of the reactive marker, held as a property on the
# container. A Brython dict exposes its keys as properties too, so this key met
# the mechanism and the component failed at mount. It is ordinary data: Python
# allows it, and an API may well send it.
d = {"$notify": "business data", "n": 1}


def bump():
    d["n"] = d["n"] + 1
</script>

<p data-k="business">{d["$notify"]}</p>
<p data-k="n">{d["n"]}</p>
<p data-k="keys">{sorted(d.keys())}</p>
<button data-k="bump" onclick={bump}>bump()</button>
