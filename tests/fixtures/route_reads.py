# Route loads: one reading only the JavaScript event, as one reading a cookie
# does, one reading the query string, the route and its params, an optional
# param that may be absent, and what a load() answers.
def reads_cookie(event):
    return event["js"].cookie


def reads_query(event):
    return event["query"].get("x")


def reads_route(event):
    return [event["route"], event["params"]["slug"]]


def reads_optional(event):
    return event["params"].get("slug", "all")


def answers(event=None):
    return {"answer": 42, "rows": [1, 2]}


async def answers_later(event=None):
    return {"answer": 42, "rows": [1, 2]}
