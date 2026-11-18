# Route loads: one reading only the JavaScript event, as one reading a cookie
# does, one reading the query string, the route and its params, an optional
# param that may be absent, and what a load() answers; and an action changing
# its URL, or handing its event to JavaScript.
def reads_cookie(event):
    return event["js"].cookie


def reads_js_query(event):
    return event["js"].url.searchParams.get("x")


def reads_js_values(event):
    return list(event["js"].url.searchParams.getAll("x"))


def reads_js_path(event):
    return event["js"].url.pathname


def shows_js_url(event):
    return event["js"].url.toString()


def moves_js_port(event):
    url = event["js"].url
    url.port = "8080"
    return url.port


def moves_js_url(event):
    dest = event["js"].url
    dest.pathname = "/receipt"
    dest.searchParams.set("saved", "1")
    return dest.href


def hands_js_event(event, find):
    return find(event["js"])


def reads_query(event):
    return event["query"].get("x")


def reads_absent(event):
    return event["query"].get("q", "")


def reads_contains(event):
    return "x" in event["query"]


def reads_item(event):
    return event["query"]["x"]


def walks_query(event):
    return sorted(event["query"])


def counts_query(event):
    return len(event["query"])


def reads_route(event):
    return [event["route"], event["params"]["slug"]]


def reads_optional(event):
    return event["params"].get("slug", "all")


def reads_team(event):
    return event["params"].get("team")


def walks_params(event):
    return sorted(event["params"])


def answers(event=None):
    return {"answer": 42, "rows": [1, 2]}


async def answers_later(event=None):
    return {"answer": 42, "rows": [1, 2]}
