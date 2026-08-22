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

<!-- Both handlers are Python. Reading the event's own attributes needs
     `from browser import html`, which jsdom cannot import — so the value comes
     from a lambda's argument here, and the DOM read is covered in a browser. -->
<input oninput={lambda: on_text("typed")} />
<button onclick={on_click}>click</button>

<p data-k="typed">{typed}</p>
<p data-k="kind">{kind}</p>
