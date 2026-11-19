"""A factory of remote functions, in a module of its own that is no remote
module: the query it makes reads its answer as a remote module's does."""

__js__ = {"$app/server": ["query"]}
__all__ = ["made"]


def made(fn):
    return query(fn)
