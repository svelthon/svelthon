<script lang="python">
# Keys written as Python string literals with a prefix, which Python reads as
# the string they spell: each row also holds the key the prefix was taken into,
# so a read by the wrong key shows.
rows = [{"name": 42, 'r"name"': 99, "C:\\new": 5, "extra": 1}]
</script>

{#each rows as {r"name": raw}}
    <output data-k="each-r">{raw}</output>
{/each}
{#each rows as {R"name": upper}}
    <output data-k="each-R">{upper}</output>
{/each}
{#each rows as {u"name": text}}
    <output data-k="each-u">{text}</output>
{/each}
{#each rows as {U"name": wide}}
    <output data-k="each-U">{wide}</output>
{/each}
{#each rows as {r"name": got=7}}
    <output data-k="each-default">{got}</output>
{/each}
{#each rows as {r"C:\new": path}}
    <output data-k="each-backslash">{path}</output>
{/each}
{#each rows as {r"name": kept, r"C:\new": dropped, **rest}}
    <output data-k="each-rest">{kept}:{",".join(sorted(rest))}</output>
{/each}

{#snippet row({r"name": raw})}
    <output data-k="snippet-r">{raw}</output>
{/snippet}
{@render row(rows[0])}

{#await rows[0] then {u"name": awaited}}
    <output data-k="await-u">{awaited}</output>
{/await}
