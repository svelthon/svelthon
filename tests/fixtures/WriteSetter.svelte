<script lang="python">
# A property whose getter counts its reads and can refuse them, and whose
# setter records how many reads came before it. The witness is
# `WriteSetterNative.svelte`, the same model in JavaScript.
class Model:
    reads = 0
    reads_at_write = -1
    blocked = False

    def __init__(self):
        self._value = "before"

    @property
    def value(self):
        Model.reads += 1
        if Model.blocked:
            raise ValueError("a read is refused, a write is not")
        return self._value

    @value.setter
    def value(self, value):
        Model.reads_at_write = Model.reads
        self._value = value
        Model.blocked = False


model = Model()


# A mapping that also holds an attribute of the name of one of its keys: the
# dot reads the attribute, so it writes there too.
class Row(dict):
    def __init__(self):
        super().__init__(label="key")
        self.label = "attribute"


row = Row()


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
