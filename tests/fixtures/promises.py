# One Python value, three ways of handing it back behind something awaitable.
#
# The value itself is built in JavaScript, by `foreign_promise.js`, for the
# reason written there: a Python argument is converted on its way into a `__js__`
# helper, so a dict handed in would already be plain data and no row could fail.
__js__ = {"./foreign_promise.js": ["foreign", "local", "custom", "rejecting"]}
__all__ = ["from_foreign", "from_local", "from_custom", "from_rejected"]


def from_foreign():
    return foreign()


def from_local():
    return local()


def from_custom():
    return custom()


def from_rejected():
    # The other half of a promise: a rejection passes through untouched.
    return rejecting()
