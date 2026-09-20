<script lang="python">
# A JavaScript function reached through `__js__`, called both ways.
__js__ = {"./foreign_keywords.js": ["measure"]}

CALLS = {
    "positional": lambda: measure(2, 3),
    "keyword": lambda: measure(2, height=3),
    "keyword only": lambda: measure(width=2, height=3),
    # An empty `**` carries no name, so there is nothing to refuse.
    "empty spread": lambda: measure(2, 3, **{}),
}


@export
def lire(quoi):
    try:
        return str(CALLS[quoi]())
    except Exception as error:
        return "raises " + type(error).__name__ + ": " + str(error)
</script>

<p data-k="ready">ready</p>
