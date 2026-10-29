<script lang="python">
# Keys that call a function a default made, which reads a name an element
# after it binds: the key binds that name too, the row's and not the
# component's.
keyfn: object
later = 99
</script>

{#each [[]] as [saved=lambda: later, later=7] (keyfn(saved()))}<output data-k="next">{later}</output>{/each}
{#each [[]] as [saved=lambda: later, {later}={"later": 7}] (keyfn(saved()))}<output data-k="braces">{later}</output>{/each}
{#each [[1], [2]] as [seed, saved=lambda: later, later=seed] (keyfn(saved()))}<output data-k="rows">{later}</output>{/each}
