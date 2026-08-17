<script lang="python">
total = 0
items = []

def tick():
    global total
    total += 1

def heavy():
    global total
    total = sum(i * i for i in range(500))

def fill():
    global items
    items = [{"id": i, "label": f"row {i}"} for i in range(500)]
</script>

<output data-k="total">{total}</output>
<button data-k="tick" onclick={tick}>tick</button>
<button data-k="heavy" onclick={heavy}>heavy</button>
<button data-k="fill" onclick={fill}>fill</button>
<ul data-k="rows">{#each items as row (row["id"])}<li>{row["label"]}</li>{/each}</ul>
