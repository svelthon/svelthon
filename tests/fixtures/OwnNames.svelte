<script lang="python">
from calendrier import date, batch

# Three ways of taking a name Svelthon also injects, none of them an assignment
# and none of them a def, which is what made all three invisible.
class Journal:
    def __init__(self, tag):
        self.tag = tag

    def __enter__(self):
        return self.tag

    def __exit__(self, *rest):
        return False


seen = []

for js in ["a", "b"]:
    seen.append(js)

with Journal("held") as slugify:
    held = slugify


label = date(3)
grouped = batch([1, 2])
looped = str(seen)
formatted = date("2026-09-10")
</script>

<p data-k="label">{label}</p>
<p data-k="grouped">{grouped}</p>
<p data-k="looped">{looped}</p>
<p data-k="formatted">{formatted}</p>
<p data-k="held">{held}</p>
