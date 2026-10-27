<script lang="python">
# Slices a template `:=` writes through, as `items[0:1] = [9]` writes one, and
# a key whose colon cuts no slice, a lambda's.
items = [1, 2, 3]
stepped = [1, 2, 3, 4]
whole = [1, 2]
grid = {}
</script>

<button data-k="slice" onclick={lambda: (items[0:1] := [9])}>slice</button>
<button data-k="open" onclick={lambda: (items[1:] := [5])}>open</button>
<button data-k="step" onclick={lambda: (stepped[::2] := [7, 8])}>step</button>
<button data-k="whole" onclick={lambda: (whole[:] := [0])}>whole</button>
<button data-k="lambda" onclick={lambda: (grid[lambda: 1] := "kept")}>lambda</button>
<output>{items}|{stepped}|{whole}|{list(grid.values())}</output>
