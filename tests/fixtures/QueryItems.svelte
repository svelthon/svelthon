<script lang="python">
# A dict whose class says what its items are, read by the page as CPython's
# `urlencode` and `json.dumps` read it: through `items()`, a refusal included.
class Selected(dict):
    def items(self):
        return [("tag", "selected")]


class Refusing(dict):
    def items(self):
        raise ValueError("query items failed")


query = Selected({"tag": "stale", "page": 2})


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
<p data-k="json">{tojson(query)}</p>
<p data-k="refused">{refused()}</p>
