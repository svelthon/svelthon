<script lang="python">
# A property whose getter counts its reads and can refuse them, and whose
# setter records how many reads came before it. The witness is
# `WriteSetterNative.svelte`, the same model in JavaScript, which counts in a
# plain `let`: here the count is a class attribute, which is state, so the
# getter counts untracked, or the binding reading it would write what it reads
# and loop, as Svelte does.
importjs { untrack } from "svelte"


def count_read():
    Model.reads += 1


class Model:
    reads = 0
    reads_at_write = -1
    blocked = False

    def __init__(self):
        self._value = "before"

    @property
    def value(self):
        untrack(count_read)
        if Model.blocked:
            raise ValueError("a read is refused, a write is not")
        return self._value

    @value.setter
    def value(self, value):
        Model.reads_at_write = Model.reads
        self._value = value
        Model.blocked = False


class Fallback(Model):
    def __getattr__(self, name):
        raise AttributeError(name)


class Delegating(Model):
    def __getattribute__(self, name):
        return object.__getattribute__(self, name)


# The same property under a class that adds an attribute protocol of its own:
# the property is still declared, so it is still where the write goes.
kind: str = "plain"
model = {"plain": Model, "getattr": Fallback, "getattribute": Delegating}[kind]()


# A mapping that also holds an attribute of the name of one of its keys: the
# dot reads the attribute, so it writes there too.
class Row(dict):
    def __init__(self):
        super().__init__(label="key")
        self.label = "attribute"


row = Row()


# An attribute nothing declares, answered by `__getattr__`, beside a key of the
# same name: only the protocol knows it is there, so it is asked.
class Virtual(dict):
    def __getattr__(self, name):
        if name == "label":
            return "virtual"
        raise AttributeError(name)


virtual = Virtual(label="key")


# A mapping whose property of a key's name raises AttributeError to say it
# holds none: the dot reads the key then, so it writes there too; and where
# the property holds one, it reads and writes the property.
class Labelled(dict):
    def __init__(self, own):
        super().__init__(label="from-map")
        self._label = own

    @property
    def label(self):
        if self._label is None:
            raise AttributeError("label")
        return self._label

    @label.setter
    def label(self, value):
        self._label = value


fallback = Labelled(None)
attribute = Labelled("from-attribute")


# A property beside rows read by index, whose `__getitem__` refuses a text: the
# attribute is found first, as a read finds it, and no key is asked for.
class Indexed:
    def __init__(self):
        self._label = "from-attribute"
        self.rows = ["first"]

    @property
    def label(self):
        return self._label

    @label.setter
    def label(self, value):
        self._label = value

    def __getitem__(self, index):
        if not isinstance(index, int):
            raise TypeError("row index must be an integer")
        return self.rows[index]


indexed = Indexed()


# A name `__getattr__` answers for one read only, once armed, beside a key of
# that name: read once, as a read reads it, the write goes to the attribute.
class Once(dict):
    def __init__(self):
        super().__init__(label="key")
        self.armed = False
        self.reads = 0

    def arm(self):
        self.armed = True

    def __getattr__(self, name):
        if name == "label":
            self.reads += 1
            if self.armed:
                self.armed = False
                return "attribute"
        raise AttributeError(name)


once = Once()


@export
def once_state():
    return [once["label"], vars(once).get("label", "none"), once.reads]


@export
def reset(block):
    Model.reads = 0
    Model.reads_at_write = -1
    Model.blocked = block


@export
def written():
    return [model._value, Model.reads_at_write]


@export
def own_fallback(text):
    fallback._label = text
</script>

<input bind:value={model.value} />
<input data-k="row" bind:value={row.label} />
<p>{row.label}|{row["label"]}</p>
<input data-k="virtual" bind:value={virtual.label} />
<p data-k="virtual">{virtual.label}|{virtual["label"]}</p>
<input data-k="fallback" bind:value={fallback.label} />
<p data-k="fallback">{fallback.label}|{fallback["label"]}|{str(fallback._label)}</p>
<input data-k="attribute" bind:value={attribute.label} />
<p data-k="attribute">{attribute.label}|{attribute["label"]}|{str(attribute._label)}</p>
<input data-k="indexed" bind:value={indexed.label} />
<p data-k="indexed">{indexed.label}|{indexed[0]}</p>
<button data-k="once" onclick={lambda: (once.arm(), (once.label := "edited"))}>once</button>
