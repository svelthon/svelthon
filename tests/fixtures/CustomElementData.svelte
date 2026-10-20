<script lang="python">
importjs {PROBE} from "./custom_probe.js"

data = ["a", "b"]
empty = []
attrs = {"open": ["c"], "hidden": ["d"]}
tag = "svelthon-probe"
hidden = ["e"]
standard = "details"
switched = "details"

def swap():
    global switched
    switched = "svelthon-probe"
</script>

<svelthon-probe data-k="named" open={data}></svelthon-probe>
<svelthon-probe data-k="empty" open={empty}></svelthon-probe>
<svelthon-probe data-k="disabled" disabled={data}></svelthon-probe>
<svelthon-probe data-k="spread" {**attrs}></svelthon-probe>
<svelthon-probe data-k="hidden" hidden={data}></svelthon-probe>
<details data-k="standard" open={empty}></details>
<svelte:element this={tag} data-k="dynamic" open={data} hidden={data}></svelte:element>
<svelte:element this={tag} data-k="shorthand" {hidden}></svelte:element>
<svelte:element this={tag} data-k="dynamicSpread" {**attrs}></svelte:element>
<svelte:element this={standard} data-k="dynamicStandard" open={empty}></svelte:element>
<svelte:element this={switched} data-k="switched" open={data} />
<button data-k="switch" onclick={swap}>switch</button>
