<script lang="python">
kind: str = "if"
bag = ["old", "other"]


def fail():
    raise ValueError("unused-default-read")
</script>

{#snippet branch(x=fail())}
    <input bind:value={bag[0 if True else x]} />
    <output>{bag[0]}</output>
{/snippet}

{#snippet shortcut(x=fail())}
    <input bind:value={bag[0 if (False and x) else 0]} />
    <output>{bag[0]}</output>
{/snippet}

{#if kind == "if"}
    {@render branch()}
{:else}
    {@render shortcut()}
{/if}
