<script lang="python">
name: str          # required
punct: str = "!"   # used when the parent passes nothing

greeting = "Hello"

def shout():
    global greeting
    greeting = greeting.upper()
</script>

<button onclick={shout}>shout()</button>
<output>{greeting} {name}{punct}</output>
