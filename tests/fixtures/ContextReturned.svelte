<script lang="python">
class Price(float):
    pass

rows = ["a"]
price = Price(0.5)
half = 0.5

def greet():
    return "hi"

same = [
    set_context("rows", rows) is rows,
    set_context("price", price) is price,
    set_context("half", half) is half,
    set_context("greet", greet) is greet,
]
model = set_context("model", {"count": 0})
</script>

<p data-k="same">{" ".join("1" if one else "0" for one in same)}</p>
<p data-k="model">{model["count"]}</p>
