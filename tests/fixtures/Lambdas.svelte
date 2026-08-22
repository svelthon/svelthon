<script lang="python">
# A handler written as a Python lambda, in the two shapes that matter: one that
# closes over a block variable, and one that reads the event.
peps = [703, 484]

picked = "none"
typed = "none"


def choose(number):
    global picked
    picked = "PEP {}".format(number)


def on_text(value):
    global typed
    typed = value
</script>

{#each peps as pep}
    <button data-k="pick-{pep}" onclick={lambda: choose(pep)}>{pep}</button>
{/each}

<p data-k="picked">{picked}</p>
<button data-k="say" onclick={lambda: on_text("said")}>say</button>
<p data-k="typed">{typed}</p>
