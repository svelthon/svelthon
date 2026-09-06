# What a directive names, living in a module rather than in the component.
def mark(node, options=None):
    node.textContent = "acted"


def typewriter(node, params):
    # Two parameters, no more: Svelte calls a transition with three, and the
    # trimming is what lets a Python signature stay its own size.
    text = node.textContent

    def tick(t, u):
        # `t` is fractional, and a Python int() of it is what fails when the
        # float never crossed the boundary as a float.
        node.textContent = text[: int(len(text) * t)]

    return {"duration": len(text), "tick": tick}
