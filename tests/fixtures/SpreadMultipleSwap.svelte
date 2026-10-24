<script lang="python">
# A select a spread makes multiple, then single, then multiple again, bound to
# a list that is the selection of the multiple one and the value of an option
# of the single one: by a key of the spread's dict, or by a new dict.
kind: str = "none"
form: str = "field"
option = None if kind == "none" else 0.5 if kind == "float" else {"id": 1}
original = [option]
picked = original
attrs = {"multiple": True}


@export
def swap():
    global attrs
    if form == "whole":
        attrs = {"multiple": not attrs["multiple"]}
    else:
        attrs["multiple"] = not attrs["multiple"]
</script>

<select {**attrs} bind:value={picked}>
    {#if attrs["multiple"]}
        <option value={option}>item</option>
    {:else}
        <option value={original}>list</option>
    {/if}
    <option value={9}>other</option>
</select>
