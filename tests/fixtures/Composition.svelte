<!-- A Python component has a single instance <script>: children are imported in
     a <script module>, whose declarations the template can see. -->
<script module>
    import Row from './Row.svelte';
</script>

<script lang="python">
class Item:
    def __init__(self, label, qty):
        self.label = label
        self.qty = qty

    @property
    def double(self):
        return self.qty * 2

objs = [Item("a", 1), Item("b", 2)]
dicts = [{"label": "x", "qty": 9}]
pairs = [("k", 1)]
</script>

<p data-k="obj">{#each objs as o}[{o.label}:{o.qty}]{/each}</p>
<p data-k="prop">{#each objs as o}[{o.double}]{/each}</p>
<p data-k="dict">{#each dicts as d}[{d["label"]}|{d["qty"]}]{/each}</p>
<p data-k="tuple">{#each pairs as t}[{t[0]}={t[1]}]{/each}</p>
<ul data-k="child">{#each objs as o}<Row row={o} />{/each}</ul>
<ul data-k="child_prop">{#each objs as o}<Row row={o} prefix="-" />{/each}</ul>
