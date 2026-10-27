<script lang="python">
# A `slice` of the author's, which a subscript never calls: `items[0:1] = [9]`
# writes the slice whatever `slice` names, and so does a template `:=`.
items = [1, 2, 3]
counts = [1, 2, 3]
data = {}


def slice(start, stop):
    return 0


@export
def number():
    global slice
    slice = 0
</script>

<button data-k="function" onclick={lambda: (items[0:1] := [9])}>function</button>
<button data-k="number" onclick={lambda: (counts[1:] := [5])}>number</button>
<button data-k="lambda" onclick={lambda: (data[1 if True else lambda: 2] := 42)}>lambda</button>
<output>{items}|{counts}|{data}</output>
