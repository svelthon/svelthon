<script lang="python">
name: str          # prop requis
punct: str = "!"   # prop avec défaut

greeting = "Bonjour"                 # état interne
initial = f"{greeting} {name}"       # un prop est lisible dès l'init

def shout():
    global greeting
    greeting = greeting.upper()
</script>

<p data-k="line">{greeting} {name}{punct}</p>
<p data-k="initial">{initial}</p>
<button onclick={shout}>crier</button>
