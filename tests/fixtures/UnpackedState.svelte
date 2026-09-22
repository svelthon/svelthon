<script lang="python">
# Names of the module bound together, in each shape an assignment can take.
plain = 0
a, b = 0, 0
[c, (d, e)] = [0, (0, 0)]
first, *rest = [0, 1, 2]


def bump():
    global plain, a, b, d, first, rest
    plain += 1
    a += 1
    b += 1
    d += 1
    first += 1
    rest = rest + [3]
</script>

<button data-k="bump" onclick={bump}>bump</button>
<p data-k="shown">{plain} {a} {b} {c} {d} {e} {first} {len(rest)}</p>
