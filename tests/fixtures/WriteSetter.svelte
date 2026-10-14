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


@export
def reset(block):
    Model.reads = 0
    Model.reads_at_write = -1
    Model.blocked = block


@export
def written():
    return [model._value, Model.reads_at_write]
</script>

<input bind:value={model.value} />
<input data-k="row" bind:value={row.label} />
<p>{row.label}|{row["label"]}</p>
<input data-k="virtual" bind:value={virtual.label} />
<p data-k="virtual">{virtual.label}|{virtual["label"]}</p>
