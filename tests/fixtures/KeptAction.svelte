<script module>
import { keep, back } from './directive_kept.js';
</script>
<script lang="python">
# The imported action converts its own argument, once: what it keeps is what a
# named import is handed, and handed back it is the dict itself.
options = {"weight": 0.25}

@export
def same():
    return back() is options
</script>

<p use:keep={options}>kept</p>
