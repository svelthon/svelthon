<script lang="python">
# A dict keeps its string keys as ordinary JavaScript properties and everything
# else in a hash table. The reactive walk read the properties, so the children of
# a table indexed by id were never handed the watch: mutating one changed the
# data and left the page as it was.
numeric = {1: []}
textual = {"one": []}


def number_child():
    for value in numeric.values():
        value.append(3)


def text_child():
    for value in textual.values():
        value.append(3)
</script>

<button data-k="number" onclick={number_child}>number</button>
<button data-k="text" onclick={text_child}>text</button>

<p data-k="numeric">{numeric}</p>
<p data-k="textual">{textual}</p>
