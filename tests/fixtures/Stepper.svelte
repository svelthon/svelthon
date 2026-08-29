<svelte:options customElement="my-stepper" />

<script lang="python">
count = 0


def bump():
    global count
    count += 1
    # A custom element answers the page through DOM events, never through props.
    host().dispatchEvent(js.CustomEvent.new("stepped", to_js({"detail": count})))
</script>

<button data-k="bump" onclick={bump}>{count}</button>
