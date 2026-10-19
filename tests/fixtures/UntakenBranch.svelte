<script lang="python">
kind: str = "if true"
rows = [{}]


def fail():
    raise ValueError("branch-was-read")
</script>

{#if True}
    {y => fail()}
    {#if kind == "if true"}
        <output>{7 if True else y}</output>
    {:else if kind == "if false"}
        <output>{y if False else 7}</output>
    {:else if kind == "and"}
        <output>{7 if (False and y) else 9}</output>
    {:else if kind == "or"}
        <output>{7 if (True or y) else 9}</output>
    {:else if kind == "lambda"}
        <output>{(lambda: y)() if False else 7}</output>
    {:else if kind == "each index"}
        {#each rows as row, i}
            <output>{7 if True else i}</output>
        {/each}
    {:else}
        <output>{y if True else 7}</output>
    {/if}
{/if}
