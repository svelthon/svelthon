# A class of `src/lib/server/`, which the browser never imports: an instance a
# `load()` returns cannot cross to the page by its class's name.
__all__ = ["Vault"]


class Vault:
    def __init__(self):
        self.key = "kept on the server"
