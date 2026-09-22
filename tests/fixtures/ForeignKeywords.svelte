<script lang="python">
# A JavaScript function reached through `__js__`, called both ways.
__js__ = {"./foreign_keywords.js": ["measure", "counted", "defaulted"]}

EMPTY = {}

CALLS = {
    "positional": lambda: measure(2, 3),
    "keyword": lambda: measure(2, height=3),
    "keyword only": lambda: measure(width=2, height=3),
    # An empty `**` carries no name, so there is nothing to refuse — and
    # nothing to *pass on* either. The carrier used to stay in the argument
    # list, so the function was handed one more than the author wrote.
    "empty spread": lambda: measure(2, 3, **{}),
    "counted": lambda: counted(1),
    "counted with empty spread": lambda: counted(1, **{}),
    "counted with an empty name": lambda: counted(1, **EMPTY),
    "default kept": lambda: defaulted(1),
    "default with empty spread": lambda: defaulted(1, **{}),
}


@export
def lire(quoi):
    try:
        return str(CALLS[quoi]())
    except Exception as error:
        return "raises " + type(error).__name__ + ": " + str(error)
</script>

<p data-k="ready">ready</p>
