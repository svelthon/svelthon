<script lang="python">
# Ce que le préprocesseur produirait si les expressions du gabarit étaient
# compilées en Python : une fonction cachée par expression, les variables de bloc
# passées en argument.
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

def __expr_0(row):
    return row["label"]

def __expr_1(row):
    return row["id"]
</script>

<output data-k="total">{total}</output>
<button data-k="tick" onclick={tick}>tick</button>
<button data-k="heavy" onclick={heavy}>heavy</button>
<button data-k="fill" onclick={fill}>fill</button>
<ul data-k="rows">{#each items as row (__expr_1(row))}<li>{__expr_0(row)}</li>{/each}</ul>
