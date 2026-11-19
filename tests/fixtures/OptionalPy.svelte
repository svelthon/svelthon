<script lang="python">
# A Python child whose prop is optional, read with its default while the parent
# passes nothing, and picked when its button is clicked.
ticket: str = "fallback"
tick: int
picked = "-"


def pick():
    global picked
    picked = ticket
</script>

<p data-k="summary">{ticket} ({tick})</p>
<button data-k="pick" onclick={pick}>{picked}</button>
