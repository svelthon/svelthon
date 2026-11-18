<script lang="python">
# Each field of the parent's JavaScript object handed on twice, once under a
# name that starts with `on`: the handlers' branch.
importjs Confirm from "./CallbackPropsConfirm.svelte"
importjs ConfirmPython from "./CallbackPropsConfirmPython.svelte"

config: object
revision: int
python: bool = False
</script>

{#if python}
    <ConfirmPython {revision} choice={config.choice} onboarding={config.choice} confirm={config.confirm} onconfirm={config.confirm} />
{:else}
    <Confirm {revision} choice={config.choice} onboarding={config.choice} confirm={config.confirm} onconfirm={config.confirm} />
{/if}
