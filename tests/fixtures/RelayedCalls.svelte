<script lang="python">
    # The same functions read by a template: by name from the JavaScript module
    # that hands them on, as a member of its namespace, and from Python.
    from relayed_source import describe as original, Price

    importjs {describe} from "./relayed_source.js"
    importjs * as relay from "./relayed_source.js"
</script>

<output data-k="named">{describe(1.0)}|{describe(Price(0.5))}</output>
<output data-k="namespace">{relay.describe(1.0)}|{relay.describe(Price(0.5))}</output>
<output data-k="python">{original(1.0)}|{original(Price(0.5))}</output>
