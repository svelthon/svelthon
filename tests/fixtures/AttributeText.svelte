<script lang="python">
class Point:
    def __str__(self):
        return "Point(3)"


class Caption:
    def __str__(self):
        raise ValueError("a caption overridden is never made text")


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
volume = 0.25
media = {"volume": volume}
tag = "video"
fallback = {"title": Caption()}
chosen = {"title": "Published"}
caption = Caption()
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
<video id="volume" {volume}></video>
<video id="volume-spread" {**media}></video>
<svelte:element this={tag} id="volume-element" {volume}></svelte:element>
<select id="default" defaultValue={0.75}>
    <option value={0.25}>Quiet</option>
    <option value={0.75}>Loud</option>
</select>
<p id="overridden" {**fallback} title="Published"></p>
<p id="overriding" title={caption} {**chosen}></p>
