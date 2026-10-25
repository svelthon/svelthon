<script lang="python">
# Elements to Svelte that no lowercase letter starts: their class follows
# Python's truth, an empty list being false, however it is written.
classes = {"active": [], "visible": True}


@export
def change():
    classes["active"] = [] if classes["active"] else [1]
</script>

<Dashed-probe data-k="first-named" class={classes}>a</Dashed-probe>
<Dashed-probe data-k="first-spread" {**{"class": classes}}>a</Dashed-probe>
<Dashed-probe data-k="first-list" class={["base", classes, [], None]}>a</Dashed-probe>
<Dashed-Probe data-k="parts-named" class={classes}>b</Dashed-Probe>
<Dashed-Probe data-k="parts-spread" {**{"class": classes}}>b</Dashed-Probe>
<Dashed-Probe data-k="parts-list" class={["base", classes, [], None]}>b</Dashed-Probe>
<DASHED-PROBE data-k="upper-named" class={classes}>c</DASHED-PROBE>
<DASHED-PROBE data-k="upper-spread" {**{"class": classes}}>c</DASHED-PROBE>
<DASHED-PROBE data-k="upper-list" class={["base", classes, [], None]}>c</DASHED-PROBE>
