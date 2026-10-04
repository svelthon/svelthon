<script lang="python">
# A star import of a module with no `__all__`: its public names and not the
# one that starts with an underscore.
from starred_plain import *


def grow():
    rows.append(1)


def hidden():
    return "_hidden" in globals()
</script>

<button onclick={grow}>grow</button>
<p data-k="rows">{len(rows)}</p>
<p data-k="label">{label()}</p>
<p data-k="hidden">{hidden()}</p>
