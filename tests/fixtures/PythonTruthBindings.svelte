<script lang="python">
    # Each binding Svelte reads for truth, bound to a value Python finds false
    # or true, or to None, the absence from which Svelte reads the element.
    class Falsy:
        def __bool__(self):
            return False

    kind: str = "list"

    def make():
        return {"list": [], "dict": {}, "tuple": (), "set": set(), "object": Falsy(), "full": [0], "none": None}[kind]

    checked = make()
    indeterminate = make()
    opened = make()
    muted = make()
    paused = make()

    @export
    def model():
        return [type(one) is bool for one in (checked, indeterminate, opened, muted, paused)]
</script>

<input type="checkbox" data-k="checked" bind:checked />
<input type="checkbox" data-k="indeterminate" bind:indeterminate />
<details data-k="open" bind:open={opened}><summary>more</summary></details>
<audio data-k="muted" bind:muted></audio>
<audio data-k="paused" bind:paused></audio>
