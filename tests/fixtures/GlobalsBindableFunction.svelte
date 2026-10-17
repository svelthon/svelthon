<script lang="python">
    # The same name as a function the component exports, whose binding is not
    # made yet when the default is first written.
    value: object <=> None

    @export
    def Object():
        return 1

    @export
    def change(n):
        global value
        value = n
</script>

<output>{value}</output>
