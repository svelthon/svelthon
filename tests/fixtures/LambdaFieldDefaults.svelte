<script lang="python">
# A field unpacked by key whose default is a lambda written bare: its colon is
# the lambda's, not the one that renames a key.
pass
</script>

{#each [{}] as {cb=lambda: 1}}
    <output data-k="each-none">{cb()}</output>
{/each}
{#each [{}] as {cb=lambda x: x + 1}}
    <output data-k="each-one">{cb(2)}</output>
{/each}
{#each [{}] as {cb=lambda x, y: x * y}}
    <output data-k="each-two">{cb(2, 3)}</output>
{/each}
{#each [{"callback": lambda x: x - 1}] as {callback: cb=lambda x: x + 1}}
    <output data-k="each-renamed">{cb(2)}</output>
{/each}

{#snippet none({cb=lambda: 1})}
    <output data-k="snippet-none">{cb()}</output>
{/snippet}
{#snippet one({cb=lambda x: x + 1})}
    <output data-k="snippet-one">{cb(2)}</output>
{/snippet}
{#snippet two({cb=lambda x, y: x * y})}
    <output data-k="snippet-two">{cb(2, 3)}</output>
{/snippet}
{@render none({})}
{@render one({})}
{@render two({})}
