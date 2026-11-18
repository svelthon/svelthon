<script lang="python">
# Each injected helper called the way its documented signature reads. The README
# writes `to_json(value, indent=None)`, so an author writes `indent=2`.
rows = [1, 2, 3, 4]


class Name(str):
    pass


# A mapping that is not a dict: what `**` asks of one is `keys()` and
# `__getitem__`, and a Python function gets exactly that.
class Keywords:
    def __init__(self, values):
        self.values = values

    def keys(self):
        return self.values.keys()

    def __getitem__(self, name):
        return self.values[name]


CALLS = {
    "json-positional": lambda: to_json(rows, 2),
    "json-keyword": lambda: to_json(rows, indent=2),
    "batch-positional": lambda: batch(rows, 2),
    "batch-keyword": lambda: batch(rows, n=2),
    "batch-fill": lambda: batch(rows, n=3, fill=0),
    "date-keyword": lambda: date("2026-09-20", locale="en-GB"),
    # Two languages for one instant, read with the test's clock fixed.
    "from_now-english": lambda: from_now("2026-09-20", locale="en-GB"),
    "from_now-french": lambda: from_now("2026-09-20", locale="fr-FR"),
    # A spread, which is the other half of what a keyword call carries.
    "json-spread": lambda: to_json(rows, **{"indent": 2}),
    "json-mapping": lambda: to_json(rows, **Keywords({"indent": 2})),
    "slug-mapping": lambda: slugify(**Keywords({"text": "Café Noir"})),
    "slug-empty-mapping": lambda: slugify("Café Noir", **Keywords({})),
    # A key that is a subclass of str names the argument by its value.
    "str subclass key": lambda: slugify(**{Name("text"): "Café"}),
    # Data whose key is spelled `$kw` is still data, a Python dict as a
    # JavaScript object.
    "kw data": lambda: to_json({"$kw": ["ordinary", "data"]}),
    "kw js data": lambda: to_json(to_js({"$kw": ["ordinary", "data"]})),
    # A name no helper takes: the one thing the author can have got wrong.
    "unknown": lambda: to_json(rows, espace=2),
    # A signature is fixed, and a JavaScript implementation must not make it
    # permissive. Each of these is a TypeError in CPython, and each was silent
    # here: the keyword overwrote the position, the spread overwrote the
    # keyword, and the extra word was dropped by a function that had nowhere to
    # put it.
    "by both": lambda: to_json(rows, 2, indent=4),
    "size by both": lambda: batch(rows, 2, n=3),
    "twice by spread": lambda: to_json(rows, indent=2, **{"indent": 4}),
    "too many": lambda: slugify("first", "second"),
    "too many of two": lambda: to_json(rows, 2, 4),
    # An argument the signature requires and the call does not give. Each was
    # silent: the position reached the helper as `undefined` and was read there
    # as absence, so a call whose only fault is a missing argument answered.
    "nothing at all": lambda: slugify(),
    "only the optional": lambda: to_json(indent=2),
    "one of two": lambda: batch(rows),
    "neither of two": lambda: batch(),
    # And the witnesses: a position that was filled, whatever it was filled
    # with. `None`, `False`, `0` and the empty string are values an author
    # writes on purpose, and `to_json(None)` is `null` and means it.
    "explicit none": lambda: to_json(None, indent=2),
    "explicit false": lambda: to_json(False),
    "explicit zero": lambda: to_json(0),
    "empty text": lambda: slugify(""),
    # The optional one left out is not a missing argument.
    "optional left out": lambda: to_json(rows),
}


@export
def lire(quoi):
    try:
        return str(CALLS[quoi]())
    except Exception as error:
        return "raises: " + str(error)
</script>

<p data-k="ready">ready</p>
