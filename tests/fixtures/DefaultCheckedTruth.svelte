<script lang="python">
    # `defaultChecked`, given a value Python finds false or true, written by
    # name, between quotes and spread, and on a box a binding reads from it.
    class Choice:
        def __init__(self, value):
            self.value = value

        def __bool__(self):
            return self.value

    full: bool = False

    value = Choice(full)
    selected = None

    @export
    def model():
        return selected
</script>

<form>
    <input type="checkbox" data-k="direct" defaultChecked={value} />
    <input type="checkbox" data-k="quoted" defaultChecked="{value}" />
    <input type="checkbox" data-k="spread" {**{"defaultChecked": value}} />
    <input type="checkbox" data-k="bound" defaultChecked={value} bind:checked={selected} />
</form>
