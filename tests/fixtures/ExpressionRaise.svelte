<script lang="python">
zero = 0


def divide(n):
    return 1 // n
</script>

<p>markup before the expressions</p>
<p>another line of it</p>

<button data-k="inline" onclick={lambda: 1 // zero}>inline</button>
<button data-k="called" onclick={lambda: divide(zero)}>called</button>
