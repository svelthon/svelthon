<svelte:options customElement={{ tag: 'bindable-fallback-element', shadow: 'none' }} />

<script lang="python">
# A custom element's props with a default, which the page clears, or the
# component: a string, and a float that crosses as an integer.
value: object = "default"
ratio: object = 15.0


def clear():
    global value
    value = None
</script>

<p data-k="child">{value}|{ratio}</p>
<button onclick={clear}>clear</button>
