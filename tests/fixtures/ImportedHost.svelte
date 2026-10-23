<script lang="python">
    # A function of the author's JavaScript named like Svelthon's `host()`, in a
    # component that is no custom element.
    importjs {host} from "./foreign_host.js"

    count = 0
</script>

<output>{host()}</output>
