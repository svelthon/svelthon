<script lang="python">
class Item:
    def __init__(self, label):
        self.label = label

    @property
    def loud(self):
        return self.label.upper()

nothing = None
items = ["a", "b", "c"]
rows = [Item("x"), Item("y")]
mapping = {"k": 1}
flag = True
</script>

<p data-k="is">{nothing is None}</p>
<p data-k="and">{flag and len(items) > 2}</p>
<p data-k="not">{not flag}</p>
<p data-k="ternary">{"oui" if flag else "non"}</p>
<p data-k="len">{len(items)}</p>
<p data-k="slice">{items[1:]}</p>
<p data-k="fstring">{f"{len(items)} éléments"}</p>
<p data-k="comprehension">{[i.upper() for i in items]}</p>
<p data-k="subscript">{mapping["k"]}</p>
<p data-k="attr">{#each rows as r}[{r.label}:{r.loud}]{/each}</p>
<p data-k="if">{#if nothing}vrai{:else if not items}vide{:else}faux{/if}</p>
