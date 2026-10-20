<script lang="python">
    # A child held by a name that holds `None`, wherever the name is bound:
    # the script, a block, a snippet's parameter, a declaration of the markup.
    importjs Frame from "./HeldFrame.svelte"

    Selected = Frame
    Absent = None
    rows = [Frame, None]

    @export
    def clear():
        global Selected
        Selected = None
</script>

{#snippet content(Child)}<Child />{/snippet}

<div data-k="cleared"><Selected /></div>
<div data-k="none"><Absent /></div>
<div data-k="rows">{#each rows as Row}<Row />{/each}</div>
<div data-k="snippet">{@render content(None)}</div>
<div data-k="declared">{Local = None}<Local /></div>
