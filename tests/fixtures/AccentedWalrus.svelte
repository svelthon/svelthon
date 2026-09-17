<script lang="python">
# A call whose name ends on a letter `\w` does not know, with a walrus in its
# arguments. The witness differs by one character: `cafe`.
#
# `énot` is the second half of the same question, and it took a second pass to
# see: the name ends on an ASCII letter, so `NAME_END` is content, but the four
# letters before the parenthesis spell a keyword and the boundary in front of
# them was ASCII too. Its witness is `enot`, one character apart again.
#
# `grouped` is the control on the other side: a real keyword must still make the
# parenthesis a grouping, and the walrus inside it must still be rewritten into a
# write through the namespace.
result = 0
plain = 0
keyword = 0
ascii_keyword = 0
x = 0


def café(value):
    global result
    result = value + 1


def cafe(value):
    global plain
    plain = value + 1


def énot(value):
    global keyword
    keyword = value + 1


def enot(value):
    global ascii_keyword
    ascii_keyword = value + 1
</script>

<button data-k="accented" onclick={lambda: café(x := 1)}>accented</button>
<button data-k="plain" onclick={lambda: cafe(x := 1)}>plain</button>
<button data-k="keyword" onclick={lambda: énot(x := 1)}>keyword</button>
<button data-k="ascii_keyword" onclick={lambda: enot(x := 1)}>ascii keyword</button>
<button data-k="grouped" onclick={lambda: not (x := 2)}>grouped</button>
<p data-k="accented-result">{result}</p>
<p data-k="plain-result">{plain}</p>
<p data-k="keyword-result">{keyword}</p>
<p data-k="ascii_keyword-result">{ascii_keyword}</p>
<p data-k="x">{x}</p>
