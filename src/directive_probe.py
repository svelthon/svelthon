# A Python module holding what a directive names: an action and a transition.
# Both write where the page can see them, so a directive that never resolves is
# visible as an absence rather than as an error.
def mark(node, options=None):
    node.textContent = "the action ran"


def typewriter(node, params):
    text = node.textContent
    duration = len(text) * 30

    def tick(t, u):
        node.textContent = text[: int(len(text) * t)]

    return {"duration": duration, "tick": tick}
