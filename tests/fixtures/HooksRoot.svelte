<script lang="python">
    # A root whose name holds its destructor, under the name of a hook.
    importjs {record} from "./lifecycle_log.js"

    @effect.root
    def on_destroy():
        record("start")
        return lambda: record("stop")
</script>

<output>ready</output>
