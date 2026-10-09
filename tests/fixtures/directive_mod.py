# What a directive names, living in a module rather than in the component.
def mark(node, options=None):
    node.textContent = "acted"


def measured(node, value):
    # A fractional parameter, which is what tells a JavaScript number from a
    # Python float: `format` is the protocol that refuses the first.
    node.textContent = format(value, ".2f")


class Actions:
    # An object configured once, its method named by the directive.
    def measured(self, node, value):
        node.textContent = format(value, ".2f")


configured = Actions()

# A registry, reached by the template's dot like any dict.
registry = {"measured": measured}


def with_params(node, params):
    # A transition given no value: Svelte's rule gives it an empty one.
    node.textContent = format(params.get("amount", 0.5), ".2f")
    return {"duration": 0}


def moved(node, rects, params):
    # An animation given no value: Svelte still hands it the payload's place.
    node.textContent = str(params is None)
    return {"duration": 0}


def configuration(node):
    def tick(t, u):
        node.textContent = format(t, ".2f") + "/" + format(u, ".2f")

    def easing(t):
        return t / 2

    return {"duration": 0.5, "tick": tick, "easing": easing}


def nullable(node, params):
    # Optional callbacks written as None, which Svelte tests with `if (tick)`.
    return {"duration": 0.5, "css": None, "tick": None}


class NullableConfig:
    duration = 0.5
    css = None
    tick = None


def nullable_instance(node, params):
    return NullableConfig()


def nullable_deferred(node, params):
    def configure(options):
        return nullable(node, params)

    return configure


def deferred(node, params):
    # A deferred transition: Svelte calls what this returns, later.
    def configure(options):
        return configuration(node)

    return configure


class Deferred:
    def __init__(self, node):
        self.node = node

    def __call__(self, options):
        return configuration(self.node)


def deferred_instance(node, params):
    return Deferred(node)


async def later(node):
    # An action written as a coroutine: started, as a handler would be.
    node.textContent = "started"


def typewriter(node, params):
    # Two parameters, no more: Svelte calls a transition with three, and the
    # trimming is what lets a Python signature stay its own size.
    text = node.textContent

    def tick(t, u):
        # `t` is fractional, and a Python int() of it is what fails when the
        # float never crossed the boundary as a float.
        node.textContent = text[: int(len(text) * t)]

    return {"duration": len(text), "tick": tick}
