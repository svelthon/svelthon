<script lang="python">
    value: object = bindable("x")


    @export
    def clear():
        global value
        value = None
</script>

<p data-k="child">{value is None}</p>
