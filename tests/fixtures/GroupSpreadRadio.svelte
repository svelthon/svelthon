<script lang="python">
    # A radio whose value, None, comes from a spread, which the model holds.
    attrs = {"value": None}
    choice = None

    @export
    def held():
        return choice is None
</script>

<input type="radio" {**attrs} bind:group={choice} />
