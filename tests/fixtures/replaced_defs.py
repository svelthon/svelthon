# Names a `def` bound and something else replaced before the module ended.
def configure(fn):
    return {"answer": fn()}


def halve(fn):
    return 0.5


def same(fn):
    return fn


@configure
def settings():
    return 42


@halve
def ratio():
    return 0


@same
def kept():
    return 0.25


def item():
    return 0


item = 42
