<script lang="python">
# Names of the module bound together, in each shape an assignment can take.
plain = 0
a, b = 0, 0
[c, (d, e)] = [0, (0, 0)]
first, *rest = [0, 1, 2]
if (walrus := 0) == 0:
    pass


def reset():
    # The only binding of `message` is this one, in a function.
    global message
    message = 0


reset()


def bump():
    global plain, a, b, d, first, rest, walrus, message
    plain += 1
    a += 1
    b += 1
    d += 1
    first += 1
    rest = rest + [3]
    walrus += 1
    message += 1
</script>

<button data-k="bump" onclick={bump}>bump</button>
<p data-k="shown">{plain} {a} {b} {c} {d} {e} {first} {len(rest)}</p>
<p data-k="other">{walrus} {message}</p>
