<script lang="python">
name: str          # required prop
punct: str = "!"   # prop with a default

greeting = "Hello"               # internal state
initial = f"{greeting} {name}"   # a prop is readable during init

def shout():
    global greeting
    greeting = greeting.upper()
</script>

<p data-k="line">{greeting} {name}{punct}</p>
<p data-k="initial">{initial}</p>
<button onclick={shout}>shout()</button>
