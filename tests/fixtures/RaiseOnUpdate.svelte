<script lang="python">
# Python raising where Svelte alone calls it once `n` is 0, at the exit `where`
# names; and the two places Python catches what it raised, an `except` around
# a read of the derived and a boundary written in Python.
where: str = "nowhere"

n = 1
d => 1 // n
seen = ""
failure = ""


@effect
def watch():
    if where == "effect":
        1 // n


def zero():
    global n
    n = 0


def guarded():
    global seen
    try:
        seen = str(d)
    except ZeroDivisionError as error:
        seen = type(error).__name__


def failing(error, reset):
    global failure
    failure = type(error).__name__
</script>

<button data-k="zero" onclick={zero}>zero</button>
<button data-k="guarded" onclick={guarded}>guarded</button>
{#if where == "expression"}<p>{1 // n}</p>{/if}
{#if where == "derived"}<p>{d}</p>{/if}
{#if where == "boundary"}
    <svelte:boundary onerror={failing}>
        <p>{1 // n}</p>
        {#snippet failed(error, reset)}<p data-k="failed">{type(error).__name__}</p>{/snippet}
    </svelte:boundary>
{/if}
<p data-k="seen">{seen}</p>
<p data-k="failure">{failure}</p>
