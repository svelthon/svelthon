<script lang="python">
# A mapping whose metaclass hides `__getitem__` from a read of the class, or
# raises while it is read: `obj["answer"]` never asks the metaclass, so it is
# 42 in `python3`, and so is `obj.answer` in the markup.
class Hidden(type):
    def __getattribute__(cls, name):
        if name in ("__getitem__", "__setitem__"):
            raise AttributeError("class metadata hidden")
        return super().__getattribute__(name)


class Raising(type):
    def __getattribute__(cls, name):
        if name in ("__getitem__", "__setitem__"):
            raise ValueError("class metadata refused")
        return super().__getattribute__(name)


class Store:
    def __init__(self):
        self.held = {"answer": 42}

    def __getitem__(self, key):
        return self.held[key]

    def __setitem__(self, key, value):
        self.held[key] = value


class HiddenStore(Store, metaclass=Hidden):
    pass


class RaisingStore(Store, metaclass=Raising):
    pass


hidden = HiddenStore()
raising = RaisingStore()
</script>

<p data-k="hidden">{hidden.answer}</p>
<p data-k="raising">{raising.answer}</p>
<input data-k="write" type="number" bind:value={hidden.answer} />
<p data-k="held">{hidden.held["answer"]}</p>
