<script lang="python">
# Keys of a template `:=` that Python reads as one tuple, each dict holding a
# sentinel under the key a tuple split into arguments would write.
pair = {(1, 2): "before", 1: "sentinel"}
spaced = {(1, 2): "before", 1: "sentinel"}
named = {(1, 2): "before", 1: "sentinel"}
row = 1
column = 2
triple = {(1, 2, 3): "before", 1: "sentinel"}
lined = {(1, 2): "before", 1: "sentinel"}
nested = {((1, 2), 3): "before", (1, 2): "sentinel"}
single = {(1,): "before", 1: "sentinel"}
trailing = {(1, 2): "before", 1: "sentinel"}
starred = {(1, 2): "before", 1: "sentinel"}
keys = (1, 2)
alone = {(1,): "before", 1: "sentinel"}
one = (1,)
empty = {(): "before", 1: "sentinel"}
none = ()
tail = {(1, 2, 3): "before", 1: "sentinel"}
rest = (2, 3)


def shown(entries, key, other):
    return f"{entries[key]},{entries[other]},{len(entries)}"
</script>

<button data-k="pair" onclick={lambda: (pair[1, 2] := "after")}>pair</button>
<button data-k="spaced" onclick={lambda: (spaced[ 1 , 2 ] := "after")}>spaced</button>
<button data-k="named" onclick={lambda: (named[row, column] := "after")}>named</button>
<button data-k="triple" onclick={lambda: (triple[1, 2, 3] := "after")}>triple</button>
<button data-k="lined" onclick={lambda: (lined[1,
    2] := "after")}>lined</button>
<button data-k="nested" onclick={lambda: (nested[(1, 2), 3] := "after")}>nested</button>
<button data-k="single" onclick={lambda: (single[1,] := "after")}>single</button>
<button data-k="trailing" onclick={lambda: (trailing[1, 2,] := "after")}>trailing</button>
<button data-k="starred" onclick={lambda: (starred[*keys] := "after")}>starred</button>
<button data-k="alone" onclick={lambda: (alone[*one] := "after")}>alone</button>
<button data-k="empty" onclick={lambda: (empty[*none] := "after")}>empty</button>
<button data-k="tail" onclick={lambda: (tail[1, *rest] := "after")}>tail</button>
<output>{shown(pair, (1, 2), 1)}|{shown(spaced, (1, 2), 1)}|{shown(named, (1, 2), 1)}|{shown(triple, (1, 2, 3), 1)}|{shown(lined, (1, 2), 1)}|{shown(nested, ((1, 2), 3), (1, 2))}|{shown(single, (1,), 1)}|{shown(trailing, (1, 2), 1)}|{shown(starred, (1, 2), 1)}|{shown(alone, (1,), 1)}|{shown(empty, (), 1)}|{shown(tail, (1, 2, 3), 1)}</output>
