<script lang="python">
# Each injected helper called the way its documented signature reads. The README
# writes `tojson(value, indent=None)`, so an author writes `indent=2`.
rows = [1, 2, 3, 4]

CALLS = {
    "json-positional": lambda: tojson(rows, 2),
    "json-keyword": lambda: tojson(rows, indent=2),
    "batch-positional": lambda: batch(rows, 2),
    "batch-keyword": lambda: batch(rows, n=2),
    "batch-fill": lambda: batch(rows, n=3, fill=0),
    "date-keyword": lambda: date("2026-09-20", locale="en-GB"),
    "fromnow-keyword": lambda: fromnow("2026-09-20", locale="en-GB"),
    # A spread, which is the other half of what `$kw` carries.
    "json-spread": lambda: tojson(rows, **{"indent": 2}),
    # A name no helper takes: the one thing the author can have got wrong.
    "unknown": lambda: tojson(rows, espace=2),
}


@export
def lire(quoi):
    try:
        return str(CALLS[quoi]())
    except Exception as error:
        return "raises: " + str(error)
</script>

<p data-k="ready">ready</p>
