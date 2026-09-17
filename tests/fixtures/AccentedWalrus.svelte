<script lang="python">
# A call whose name ends on a letter `\w` does not know, with a walrus in its
# arguments. The witness differs by one character: `cafe`.
result = 0
plain = 0


def café(value):
    global result
    result = value + 1


def cafe(value):
    global plain
    plain = value + 1
</script>

<button data-k="accented" onclick={lambda: café(x := 1)}>accented</button>
<button data-k="plain" onclick={lambda: cafe(x := 1)}>plain</button>
<p data-k="accented-result">{result}</p>
<p data-k="plain-result">{plain}</p>
