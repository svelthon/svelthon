<script lang="python">
# A float of the author's class handed to a Python child twice: as a prop,
# which stays Python, and as a CSS custom property, which Svelte writes into
# the wrapper around the child. By each way of naming the child.
importjs Child from "./CssRateChild.svelte"


class Rate(float):
    pass


value = Rate(0.5)
Held = Child


@export
def change():
    global value
    value = Rate(0.75)
</script>

{#snippet shown(Given)}<Given number={value} --rate={value} />{/snippet}

<section data-k="direct"><Child number={value} --rate={value} /></section>
<section data-k="held"><Held number={value} --rate={value} /></section>
<section data-k="dynamic"><svelte:component this={Child} number={value} --rate={value} /></section>
<section data-k="snippet">{@render shown(Child)}</section>
