<script lang="python">
    __js__ = {"./lazy_config.js": ["make", "action"]}

    @export
    def give(kind):
        return make(kind)

    @export
    def maker():
        return lambda kind: make(kind)

    @export
    def echo():
        return lambda value: value

    def wrapped(node):
        return action(node)
</script>

<p data-k="acted" use:wrapped>action</p>
