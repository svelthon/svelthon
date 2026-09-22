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
    # Two languages for one instant. Asserting the *phrasing* would have been a
    # test that moves with the clock: a fixed date reads "10 hours ago" on the
    # day and "yesterday" the morning after, which is what this one did. The
    # language is what the keyword carries, and it does not drift.
    "fromnow-english": lambda: fromnow("2026-09-20", locale="en-GB"),
    "fromnow-french": lambda: fromnow("2026-09-20", locale="fr-FR"),
    # A spread, which is the other half of what `$kw` carries.
    "json-spread": lambda: tojson(rows, **{"indent": 2}),
    # A name no helper takes: the one thing the author can have got wrong.
    "unknown": lambda: tojson(rows, espace=2),
    # A signature is fixed, and a JavaScript implementation must not make it
    # permissive. Each of these is a TypeError in CPython, and each was silent
    # here: the keyword overwrote the position, the spread overwrote the
    # keyword, and the extra word was dropped by a function that had nowhere to
    # put it.
    "by both": lambda: tojson(rows, 2, indent=4),
    "size by both": lambda: batch(rows, 2, n=3),
    "twice by spread": lambda: tojson(rows, indent=2, **{"indent": 4}),
    "too many": lambda: slugify("first", "second"),
}


@export
def lire(quoi):
    try:
        return str(CALLS[quoi]())
    except Exception as error:
        return "raises: " + str(error)
</script>

<p data-k="ready">ready</p>
