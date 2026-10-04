<script lang="python">
a = 1
b = 2
assigned = a, b
pair => a, b
size: tuple <=> 3, 4
=> js.arrowTupleLog.push(f"first {a}"), js.arrowTupleLog.push(f"second {a}")


def bump():
    global a
    a += 1
</script>

<p data-k="assigned">{assigned}</p>
<p data-k="template">{a, b}</p>
<p data-k="pair">{pair}</p>
<p data-k="size">{size}</p>
<button onclick={bump}>bump</button>
