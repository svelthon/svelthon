<script lang="python">
# One config handed to a JavaScript child by name and in a spread, and an
# option whose value is a dict handed to its element in a spread.
importjs SpreadConfigChild from "./SpreadConfigChild.svelte"

config = {"rate": 0.25}
attrs = {"config": config, "scalar": 0.25}
choices = [{"id": 0.25}, {"id": 0.5}]
chosen = choices[0]

@export
def change():
    global chosen
    config["rate"] = 0.5
    attrs["scalar"] = 0.5
    chosen = choices[1]
</script>

<SpreadConfigChild label="direct" config={config} scalar={attrs["scalar"]} />
<SpreadConfigChild label="spread" {**attrs} />
<select bind:value={chosen}>
    {#each choices as one}<option {**{"value": one}}>{one["id"]}</option>{/each}
</select>
