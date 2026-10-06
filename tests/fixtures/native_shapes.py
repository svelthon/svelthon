"""A native JavaScript value reaching a consumer by each of the three routes.

Where a value sits must not decide what it becomes: handed over directly, given
back by a function, or held inside a container, an object of a class of its own
is the same object with the same prototype.
"""

__js__ = {"./native_shapes.js": ["service", "plain", "actions"]}

__all__ = ["direct", "plain_direct", "actions_direct", "python_actions", "returned", "held", "keyed"]

# The value, published as itself.
direct = service
plain_direct = plain
actions_direct = actions


def save():
    return "saved"


# The shape SvelteKit's `actions` takes, a mapping of Python functions.
python_actions = {"save": save}


def returned():
    # The same object, given back by a call.
    return service


def held():
    # And inside a container, which carries the adaptation rule to its children.
    return [service]


def keyed():
    return {"one": service}
