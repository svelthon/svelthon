<script lang="python">
importjs {PROBE} from "./custom_probe.js"

data = ["a", "b"]
empty = []
attrs = {"open": ["c"]}
</script>

<svelthon-probe data-k="named" open={data}></svelthon-probe>
<svelthon-probe data-k="empty" open={empty}></svelthon-probe>
<svelthon-probe data-k="disabled" disabled={data}></svelthon-probe>
<svelthon-probe data-k="spread" {**attrs}></svelthon-probe>
<details data-k="standard" open={empty}></details>
