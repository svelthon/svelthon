<script lang="python">
# The two inbound names, on the same payload. The key spelled "items" is there
# on purpose: on an unconverted JavaScript object it shadows the dict method,
# and `.items()` then calls an integer.
TEXT = '{"type": "Fragment", "nodes": [{"type": "Text"}, 2], "meta": {"k": 1}, "items": 42}'

parsed = from_json(TEXT)

# `to_py` takes the value, `from_json` takes the text — so the two spellings
# below have to agree.
converted = to_py(js.JSON.parse(TEXT))

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
plain = to_py("already a string")
empty = from_json("null")

# A value that is already Python. `to_py` is a guard an author puts where the
# data *might* have come from JavaScript, so it must leave what was already ours
# alone: a Brython tuple is a JavaScript array too, and rebuilding it made a
# list of it.
pair = (1, 2)
kept_pair = to_py(pair)
kept_kind = type(kept_pair).__name__

xs = [1, 2]
kept_list = to_py(xs) is xs

# And an array that really did come from JavaScript still becomes a list.
foreign = to_py(js.JSON.parse("[1, 2]"))
foreign_kind = type(foreign).__name__

# A payload whose *root* is an array. The nested ones above are converted by
# Brython's own walk; the root is the one thing a method on an object cannot
# speak for, so it is converted here — and a JSObj answers neither a slice nor
# `.append()`.
rooted = from_json("[1, [2], 3]")
rooted_kind = type(rooted).__name__
rooted_slice = rooted[:1]
rooted_inner = isinstance(rooted[1], list)
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
<p data-k="kept_kind">{kept_kind}</p>
<p data-k="kept_list">{kept_list}</p>
<p data-k="foreign_kind">{foreign_kind}</p>
<p data-k="rooted_kind">{rooted_kind}</p>
<p data-k="rooted_slice">{rooted_slice}</p>
<p data-k="rooted_inner">{rooted_inner}</p>
