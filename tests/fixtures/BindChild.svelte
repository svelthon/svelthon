<script lang="python">
value: str = bindable()
tag: str = bindable("default")

def shout():
    global value
    value = value.upper()
</script>

<button data-k="shout" onclick={shout}>shout()</button>
<output data-k="value">{value}</output>
<output data-k="tag">{tag}</output>
