<script lang="python">
# Bindable props named like Svelte's runes, one of them left to the parent.
state: int <=> 1
props: int <=> 2
host: int = bindable()


@export
def step():
    global state
    state += 1
</script>

<output>{state}|{props}|{host}</output>
