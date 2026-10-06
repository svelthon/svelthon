<script lang="python">
    @export
    def publish():
        set_context('k', 1)

    @export
    def read():
        return get_context('k')
</script>

<p>late</p>
