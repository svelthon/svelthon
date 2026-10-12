<script lang="python">
# `group` on a component is an ordinary prop, and its binding crosses as any
# other does: the JavaScript child reads a number, or nothing for None, and
# what it writes back is a float.
importjs Child from './GroupPropChild.svelte'

kind: str = "float"
form: str = "short"
group = None if kind == "none" else 0.25
child = None


@export
def write():
    child.write()


@export
def model():
    return f"{type(group).__name__}|{group}"
</script>

{#if form == "short"}
    <Child bind:group bind:this={child} />
{:else}
    <Child bind:group={group} bind:this={child} />
{/if}
