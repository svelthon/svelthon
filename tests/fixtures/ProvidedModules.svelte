<script lang="python">
# Every module the runtime holds, imported the way an author would: each one
# passes the compiler's check and is found at mount.
import browser
import browser.aio
import browser.html
import javascript
import builtins
import _sys
import _warnings
import _importlib
import _suggestions
from browser import window

held = ",".join(sorted(window.Object.keys(window.__BRYTHON__.imported)))
</script>

<p data-k="held">{held}</p>
