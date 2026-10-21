<script lang="python">
    # `effect` imported from JavaScript, beside a hook: the `$effect` the hook is
    # run by was read by Svelte as a store of the import, and the component did
    # not mount.
    importjs {effect} from "./imported_decorators.js"

    mounted = 0


    @effect
    def side():
        return "the library's"


    def on_mount():
        global mounted
        mounted += 1
</script>

<p data-k="mounted">{mounted}</p>
<p data-k="side">{side()}</p>
