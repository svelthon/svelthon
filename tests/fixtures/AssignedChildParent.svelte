<script lang="python">
# A name the script assigned holds whichever child it is handed, and is told
# apart once mounted: a Python child reads the Python values, a JavaScript one
# JavaScript's own, by every way a prop is written.
importjs Child from './ShadowedPythonChild.svelte'
importjs Native from './ShadowedNativeChild.svelte'

value = 15.0
Picked = Child if value else Native
Other = Native if value else Child
</script>

<div data-r="python">
    <div data-k="named"><Picked value={value} /></div>
    <div data-k="short"><Picked {value} /></div>
    <div data-k="spread"><Picked {**{"value": value}} /></div>
    <div data-k="bound"><Picked bind:value={value} /></div>
</div>
<div data-r="native">
    <div data-k="named"><Other value={value} /></div>
    <div data-k="short"><Other {value} /></div>
    <div data-k="spread"><Other {**{"value": value}} /></div>
    <div data-k="bound"><Other bind:value={value} /></div>
</div>
