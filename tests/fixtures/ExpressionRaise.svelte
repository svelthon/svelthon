<script lang="python">
import raising_mod
zero = 0


def divide(n):
    return 1 // n
</script>

<p>markup before the expressions</p>
<p>another line of it</p>

<button data-k="inline" onclick={lambda: 1 // zero}>inline</button>
<button data-k="called" onclick={lambda: divide(zero)}>called</button>
<button data-k="elsewhere" onclick={lambda: raising_mod.explode()}>elsewhere</button>
<button data-k="again" onclick={lambda: 1 // zero}>the expression of line 13, written again</button>
<button data-k="lines" onclick={lambda: (
    0,
    lambda: 1 // zero,
)[1]()}>a lambda on the third line of its expression</button>
