<script lang="python">
# Every name reached through `import *`, which binds names nothing can list
# before the module runs.
from directive_life import *

value = 0.5


def bump():
    global value
    value = 0.75
</script>

<button data-k="bump" onclick={bump}>bump</button>
<p data-k="star" use:measured={0.5}>not yet</p>
<p data-k="record" use:business.measured={0.5}>not yet</p>
<p data-k="lease" use:leased={value}>not yet</p>
