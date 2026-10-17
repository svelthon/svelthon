<script lang="python">
    # A bindable prop beside a name JavaScript gives one of its globals: the
    # setter generated for the prop compares what crossed with `Object.is`.
    Object = 1
    value: object <=> 7

    @export
    def change(n):
        global value
        value = n
</script>

<output>{value}</output>
