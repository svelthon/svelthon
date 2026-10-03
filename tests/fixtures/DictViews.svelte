<script lang="python">
# The three live views of a dict, kept in names, read on paragraphs of their
# own so a name that notifies cannot repaint one that does not.
data = {"first": [1]}
keys = data.keys()
values = data.values()
items = data.items()
proxy = keys.mapping


def grow():
    data["second"] = [2]


def shrink():
    del data["first"]


def change():
    data["second"].append(3)
</script>

<button data-k="grow" onclick={grow}>grow</button>
<button data-k="shrink" onclick={shrink}>shrink</button>
<button data-k="change" onclick={change}>change</button>
<p data-k="keys">{",".join(keys)}</p>
<p data-k="values">{[len(one) for one in values]}</p>
<p data-k="items">{[(key, len(one)) for key, one in items]}</p>
<p data-k="proxy">{",".join(proxy)}</p>
