<script lang="python">
    class Rows(list):
        pass

    rows = [1, 2, 3]
    order = [1, 2, 3]
    counts = {"a": 1}
    tags = {"x"}
    mine = Rows([1, 2])
</script>

<button data-k="clear" onclick={rows.clear}>clear</button>
<button data-k="reverse" onclick={order.reverse}>reverse</button>
<button data-k="dict" onclick={counts.clear}>dict</button>
<button data-k="set" onclick={tags.pop}>set</button>
<button data-k="subclass" onclick={mine.clear}>subclass</button>
<p>{len(rows)} {order} {len(counts)} {len(tags)} {len(mine)}</p>
