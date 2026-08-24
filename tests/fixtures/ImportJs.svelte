<script lang="python">
importjs Child from "./ImportJsChild.svelte"
importjs {fade as fondu} from "svelte/transition"
importjs * as easing from "svelte/easing"
importjs "./importjs.css"

label = "parent"
named = "yes" if fondu else "no"
namespaced = "yes" if easing.cubicOut else "no"
</script>

<Child label={label} />
<p data-k="named">{named}</p>
<p data-k="namespace">{namespaced}</p>
