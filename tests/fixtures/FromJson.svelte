<script lang="python">
# The two inbound names, on the same payload. The key spelled "items" is there
# on purpose: on an unconverted JavaScript object it shadows the dict method,
# and `.items()` then calls an integer.
TEXT = '{"type": "Fragment", "nodes": [{"type": "Text"}, 2], "meta": {"k": 1}, "items": 42}'

parsed = fromjson(TEXT)

# `to_python` takes the value, `fromjson` takes the text — so the two spellings
# below have to agree.
converted = to_python(js.JSON.parse(TEXT))

is_dict = isinstance(parsed, dict)
got = parsed.get("type")
pairs = len(parsed.items())
collides = parsed["items"]

nested = isinstance(parsed["meta"], dict)
listed = isinstance(parsed["nodes"], list)
inside = isinstance(parsed["nodes"][0], dict)
scalar = parsed["nodes"][1]

agree = converted["meta"]["k"] == parsed["meta"]["k"]
converted_dict = isinstance(converted, dict)
converted_list = isinstance(converted["nodes"], list)

# What the framework itself never sees: a value reached for by hand.
plain = to_python("already a string")
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
<p data-k="agree">{agree}</p>
<p data-k="converted_dict">{converted_dict}</p>
<p data-k="converted_list">{converted_list}</p>
<p data-k="plain">{plain}</p>
<p data-k="empty">{empty is None}</p>
