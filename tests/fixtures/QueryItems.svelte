<script lang="python">
# A dict whose class says what its items are, read by the page as CPython's
# `urlencode` and `json.dumps` read it: through `items()`, a refusal included.
class Selected(dict):
    def items(self):
        return [("tag", "selected")]


class Refusing(dict):
    def items(self):
        raise ValueError("query items failed")


# Pairs written as lists, which a copy for JavaScript takes and JSON alone
# refuses.
class Listed(dict):
    def items(self):
        return [["tag", "selected"]]


# A mapping that is no dict: what a class needs for Python to read it as one.
class Filters:
    def __init__(self, pairs):
        self.pairs = pairs

    def keys(self):
        return [key for key, _ in self.pairs]

    def items(self):
        return list(self.pairs)

    def __getitem__(self, key):
        return dict(self.pairs)[key]

    def __iter__(self):
        return iter(self.keys())

    def __len__(self):
        return len(self.pairs)

    def __str__(self):
        return "filters"


query = Selected({"tag": "stale", "page": 2})
listed = Listed({"tag": "selected"})
filters = Filters([("tag", "été"), ("page", 2)])


def refused():
    try:
        return urlencode(Refusing({"tag": "stale"}))
    except ValueError as error:
        return f"raises: {error}"


@export
def read():
    return urlencode(query)
</script>

<p data-k="query">{urlencode(query)}</p>
<p data-k="json">{to_json(query)}</p>
<p data-k="refused">{refused()}</p>
<p data-k="copied">{to_js(listed).tag}</p>
<p data-k="mapping">{urlencode(filters)}</p>
