<script lang="python">
# Both handlers are Python, and the first one walks the DOM — `event.target` is
# a node, and reading `.value` off it goes through Brython's `browser.html`.
# Nothing imports that module here: brython.js registers it on its own, as long
# as it recognises a DOM, which Bryntime arranges under jsdom.
typed = ""
kind = ""

def on_text(event):
    global typed
    typed = event.target.value.upper()

def on_click(event):
    global kind
    kind = type(event).__name__
</script>

<input oninput={on_text} />
<button onclick={on_click}>click</button>

<p data-k="typed">{typed}</p>
<p data-k="kind">{kind}</p>
