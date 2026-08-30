<script lang="python">
# What a JavaScript value has to become before Python can work on it. The key
# spelled "items" is there on purpose: on an unconverted JavaScript object it
# shadows the dict method and `.items()` calls an integer.
TEXT = '{"type": "Fragment", "nodes": [{"type": "Text"}, 2], "meta": {"k": 1}, "items": 42}'

parsed = fromjson(TEXT)

# The same payload arriving already parsed, as `await res.json()` hands it back.
preparsed = fromjson(js.JSON.parse(TEXT))

is_dict = isinstance(parsed, dict)
got = parsed.get("type")
pairs = len(parsed.items())
collides = parsed["items"]

nested = isinstance(parsed["meta"], dict)
listed = isinstance(parsed["nodes"], list)
inside = isinstance(parsed["nodes"][0], dict)
scalar = parsed["nodes"][1]

same = preparsed["meta"]["k"]
empty = fromjson("null")
</script>

<p data-k="is_dict">{is_dict}</p>
<p data-k="got">{got}</p>
<p data-k="pairs">{pairs}</p>
<p data-k="collides">{collides}</p>
<p data-k="nested">{nested}</p>
<p data-k="listed">{listed}</p>
<p data-k="inside">{inside}</p>
<p data-k="scalar">{scalar}</p>
<p data-k="same">{same}</p>
<p data-k="empty">{empty is None}</p>
