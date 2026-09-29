<script lang="python">
# Values Python finds false and JavaScript finds true, on the attributes the DOM
# and Svelte read for truth: the boolean ones, and `class`.
class Selection:
    def __bool__(self):
        return False


empty = []
nothing = {}
selection = Selection()
zero = 0.0
chosen = ["x"]
</script>

<div data-k="hidden" hidden={empty}>x</div>
<button data-k="disabled" disabled={selection}>x</button>
<input data-k="checked" type="checkbox" checked={empty} />
<input data-k="required" required={nothing} />
<details data-k="open" open={empty}><summary>x</summary></details>
<button data-k="witness" disabled={chosen}>x</button>
<div data-k="dict" class={{"on": zero, "full": empty, "shown": True}}></div>
<div data-k="list" class={["base", None, "on" if zero else "", selection and "sel"]}></div>
<div data-k="text" class={"plain words"}></div>
