# What a directive reaches through `import *`, a JavaScript record, and an
# action that hands back an instance rather than a dict.
__js__ = {"./directive_native.js": ["record"]}
__all__ = ["business", "measured", "Lease", "leased"]

business = record()


def measured(node, value):
    node.textContent = format(value, ".2f")


class Lease:
    def __init__(self, node, value):
        self.node = node
        self.update(value)

    def update(self, value):
        self.node.textContent = format(value, ".2f")

    def destroy(self):
        self.node.dataset.cleanup = "done"


def leased(node, value):
    return Lease(node, value)
