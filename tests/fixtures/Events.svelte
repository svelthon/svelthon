<script lang="python">
typed = ""
kind = ""

def on_text(value):
    global typed
    typed = value.upper()

def on_click(event):
    global kind
    kind = type(event).__name__
</script>

<!-- The template is JavaScript: it pulls the value out, Python does the work. -->
<input oninput={(e) => on_text(e.target.value)} />
<button onclick={on_click}>click</button>

<p data-k="typed">{typed}</p>
<p data-k="kind">{kind}</p>
