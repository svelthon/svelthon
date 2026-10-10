<script lang="python">
# A class used as a namespace of settings, an attribute of it bound to a field
# and read on the class: bound by `class`, and by `=`, the witness.
way: str = "class"


class Settings:
    theme = "light"


class _Assigned:
    theme = "light"


Assigned = _Assigned


@export
def model():
    return (Settings if way == "class" else Assigned).theme
</script>

{#if way == "class"}
    <input bind:value={Settings.theme} />
    <p>{Settings.theme}</p>
{:else}
    <input bind:value={Assigned.theme} />
    <p>{Assigned.theme}</p>
{/if}
