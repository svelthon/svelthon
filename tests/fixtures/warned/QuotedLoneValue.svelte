<script lang="python">
# One value written bare and between either quotes: to a child written in
# Python, to one written in JavaScript, and to the DOM. Svelte warns about the
# quotes on a component, and reads the value itself.
importjs Child from "../QuotedLoneChild.svelte"
importjs JavaScriptChild from "../QuotedLoneChildJs.svelte"

kind: str = "int"
chosen = 1
item = 1
missing = None


def callback():
    return 1


def value():
    if kind == "int":
        return 7
    if kind == "none":
        return None
    if kind == "list":
        return [7]
    return callback
</script>

<div data-k="python-bare"><Child data={value()} /></div>
<div data-k="python-double"><Child data="{value()}" /></div>
<div data-k="python-single"><Child data='{value()}' /></div>
<div data-k="js-bare"><JavaScriptChild data={value()} /></div>
<div data-k="js-double"><JavaScriptChild data="{value()}" /></div>
<div data-k="js-single"><JavaScriptChild data='{value()}' /></div>
<a href="{missing}" title='{missing}'>link</a>
<select bind:value={chosen}><option value="{item}">one</option></select>
