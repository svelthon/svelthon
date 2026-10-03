<script lang="python">
# Names bound by an import no statement lists, then a list among them
# appended to in place.
from starred_rows import *


def grow():
    rows.append(1)
</script>

<button onclick={grow}>grow</button>
<p data-k="rows">{len(rows)}</p>
<p data-k="label">{label()}</p>
