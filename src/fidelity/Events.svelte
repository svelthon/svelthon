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

<!-- Le gabarit est du JavaScript : on y extrait la valeur, Python fait le calcul. -->
<input oninput={(e) => on_text(e.target.value)} />
<button onclick={on_click}>clic</button>

<p data-k="typed">{typed}</p>
<p data-k="kind">{kind}</p>
