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
