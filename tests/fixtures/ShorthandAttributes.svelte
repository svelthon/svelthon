<script lang="python">
# Attributes written as the shorthand beside what reads a tag's other
# attributes: `{checked}` beside `bind:group`, and `{MULTIPLE}`, which the
# document reads as `multiple`, on a bound select.
checked = True
choix = []
MULTIPLE = True
picked = ["one"]


@export
def kinds():
    return f"{type(picked).__name__} {isinstance(picked, list)} {picked}"
</script>

<input data-k="box" type="checkbox" value="one" {checked} bind:group={choix} />
<select data-k="select" {MULTIPLE} bind:value={picked}>
    <option value="one">one</option>
    <option value="two">two</option>
</select>
