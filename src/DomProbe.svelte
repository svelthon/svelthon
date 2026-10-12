<script lang="python">
steps = []

def step(label, fn):
    try:
        steps.append(f"{label}=OK {fn()}")
    except Exception as e:
        steps.append(f"{label}=ERR {type(e).__name__}: {e}")

# Nothing imports `browser.html`: brython.js registers it as it loads, provided
# it recognised a DOM. That is what makes `event.target.value` work from Python
# with no import to remember — checked here in a real browser, and under jsdom by
# tests/lambdas.test.js.
import _sys

step("preloaded", lambda: "browser.html" in _sys.modules)

from browser import document

step("doc", lambda: type(document).__name__)
step("create", lambda: type(document.createElement("input")).__name__)
step("tagName", lambda: document.createElement("input").tagName)

# A route event built of an iframe's URL and Request, handed to a Python
# function by `probe.js` before this component mounted.
step("realm", lambda: js.__realmProbe)

report = " | ".join(steps)
</script>

<pre id="report">{report}</pre>
