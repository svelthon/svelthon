<script lang="python">
steps = []

def step(label, fn):
    try:
        steps.append(f"{label}=OK {fn()}")
    except Exception as e:
        steps.append(f"{label}=ERR {type(e).__name__}: {e}")

step("import_html", lambda: __import__("browser.html") and "imported")

from browser import document

step("doc", lambda: type(document).__name__)
step("create", lambda: type(document.createElement("input")).__name__)
step("tagName", lambda: document.createElement("input").tagName)

report = " | ".join(steps)
</script>

<pre id="report">{report}</pre>
