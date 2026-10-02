<script lang="python">
# A list bound at module level by each statement that assigns a value, then
# appended to by a handler, with no `global`: Python needs none to mutate in
# place. `plain` is the witness. One paragraph per name, so a name that
# notifies cannot repaint one that does not.
from assigned_rows import rows as imported

plain = []
for loop in [[]]:
    pass
for left, right in [[[], []]]:
    pass


class Context:
    def __enter__(self):
        return []

    def __exit__(self, *args):
        return False


with Context() as entered:
    pass

match [[], []]:
    case [matched, *starred]:
        pass

match {"rows": []}:
    case {**rest}:
        pass


def change():
    for one in [plain, loop, left, right, entered, matched, starred, imported]:
        one.append(1)
    rest.update(more=1)
</script>

<button onclick={change}>change</button>
<p data-k="plain">{len(plain)}</p>
<p data-k="loop">{len(loop)}</p>
<p data-k="left">{len(left)}</p>
<p data-k="right">{len(right)}</p>
<p data-k="entered">{len(entered)}</p>
<p data-k="matched">{len(matched)}</p>
<p data-k="starred">{len(starred)}</p>
<p data-k="rest">{len(rest)}</p>
<p data-k="imported">{len(imported)}</p>
