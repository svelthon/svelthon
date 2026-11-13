"""A store holding an instance, which a JavaScript component reads and calls."""


class Cart:
    kind = "cart"

    def __init__(self):
        self.items = []

    def add(self, item):
        self.items.append(item)
        return len(self.items)

    @property
    def size(self):
        return len(self.items)

    def __str__(self):
        return f"Cart of {len(self.items)}"


cart = Cart()
