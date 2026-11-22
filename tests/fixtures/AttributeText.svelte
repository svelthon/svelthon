<script lang="python">
class Point:
    def __str__(self):
        return "Point(3)"

items = [1, 2]
single = (1,)
mapping = {"a": 1}
price = 1.0
count = 3
flag = True
nothing = None
name = "x"
point = Point()
attrs = {"title": items, "data-price": price}
</script>

<p id="list" title={items}></p>
<p id="tuple" title={single}></p>
<p id="dict" data-v={mapping}></p>
<p id="float" title={price}></p>
<p id="instance" title={point}></p>
<p id="quoted" title="{items}"></p>
<p id="shorthand" {name}></p>
<p id="spread" {**attrs}></p>
<p id="int" title={count}></p>
<p id="bool" aria-pressed={flag}></p>
<p id="none" title={nothing}></p>
<p id="class" class={["a", "b"]}></p>
<input id="value" value={price} />
