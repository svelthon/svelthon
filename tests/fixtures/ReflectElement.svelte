<svelte:options customElement={{
    tag: 'reflect-element',
    shadow: 'none',
    props: { level: { type: 'Number', reflect: true } },
}} />

<script lang="python">
# A prop its element reflects, written by the page and by the component itself,
# in halves. The witness is `ReflectElementNative.svelte`.
level: float = 1


def step():
    global level
    level += 0.5
</script>

<button data-k="step" onclick={step}>step</button>
