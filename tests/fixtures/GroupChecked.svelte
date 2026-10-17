<script lang="python">
    # A box bound to a group and to a boolean of its own, written in either
    # order, beside a box of the group alone.
    reverse: bool = False
    initial: bool = False

    picked = ["a"] if initial else []
    checked = initial

    @export
    def model():
        return [list(picked), checked]

    @export
    def toggle():
        global checked
        checked = not checked
</script>

<form>
    {#if reverse}
        <input data-k="both" type="checkbox" value="a" bind:checked={checked} bind:group={picked} />
    {:else}
        <input data-k="both" type="checkbox" value="a" bind:group={picked} bind:checked />
    {/if}
    <input data-k="other" type="checkbox" value="b" bind:group={picked} />
</form>
