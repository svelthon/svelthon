# One Python value, three ways of handing it back behind something awaitable.
#
# The value itself is built in JavaScript, by `foreign_promise.js`, for the
# reason written there: a Python argument is converted on its way into a `__js__`
# helper, so a dict handed in would already be plain data and no row could fail.
__js__ = {"./foreign_promise.js": ["foreign", "local", "custom", "awaitable", "plainFunction", "rejecting"]}
__all__ = ["from_foreign", "from_local", "from_custom", "from_callable", "from_function", "from_rejected"]


def from_foreign():
    return foreign()


def from_local():
    return local()


def from_custom():
    return custom()


def from_callable():
    # Not named `callable` on this side: that is a Python builtin, and the
    # import was shadowed by it in silence until the call said so.
    return awaitable()


def from_function():
    return plainFunction()


def from_rejected():
    # The other half of a promise: a rejection passes through untouched.
    return rejecting()
