<script module>
    import ShapeChild from './ShapeChild.svelte';
    import SpreadChild from './SpreadChild.svelte';
</script>

<script lang="python">
import shapes

obj = shapes.an_object()
dic = shapes.a_dict()

crossed_obj = shapes.describe(obj)
crossed_dic = shapes.describe(dic)


def bump():
    global obj, dic
    obj.year = 2024
    dic["year"] = 2024
</script>

<p data-k="read-obj">{obj.title}</p>
<p data-k="read-dic">{dic["title"]}</p>

<p data-k="attr-obj" title={obj.title}>x</p>
<p data-k="attr-dic" title={dic["title"]}>x</p>

<p data-k="prop-only">{obj.url}</p>

<p data-k="year-obj">{obj.year}</p>
<p data-k="year-dic">{dic["year"]}</p>

<p data-k="cross-obj">{crossed_obj}</p>
<p data-k="cross-dic">{crossed_dic}</p>

<ShapeChild one={obj} label="obj" />
<ShapeChild one={dic} label="dic" />

<div data-k="spread-obj"><SpreadChild {**obj} /></div>
<div data-k="spread-dic"><SpreadChild {**dic} /></div>

<button data-k="bump" onclick={bump}>bump</button>
