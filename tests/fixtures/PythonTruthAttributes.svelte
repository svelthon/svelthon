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
hidden = []
tag = "div"
flags = ["a", None]
spread = {"hidden": [], "class": ["a", None]}


class Mode(str):
    pass


# `hidden` has a third state, `until-found`, which stays a string.
mode = "until-found"
found_spread = {"hidden": "until-found"}
subclassed = Mode("until-found")
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

<!-- The same attributes written every other way. -->
<div data-k="shorthand" {hidden}>x</div>
<div data-k="quoted" hidden="{empty}">x</div>
<div data-k="quoted-class" class="{flags}"></div>
<svelte:element this={tag} data-k="element" hidden={empty} class={flags}>x</svelte:element>
<div data-k="spread" {**spread}>x</div>

<!-- `hidden` and its third state. -->
<div data-k="until-found" hidden={mode}>x</div>
<div data-k="until-found-spread" {**found_spread}>x</div>
<div data-k="until-found-subclass" hidden={subclassed}>x</div>
<div data-k="hidden-true" hidden={True}>x</div>
<div data-k="hidden-other-text" hidden={"yes"}>x</div>
