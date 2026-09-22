<script lang="python">
# A default that reads an earlier name of its own pattern gets that name through
# a function, and has to get the value itself: every kind a row may hold, read
# once directly and once through the default.
rows = [
    [[1, 2]],
    [{"k": 1}],
    [None],
    [2 ** 60],
    ["text"],
]
</script>

{#each rows as [a, b=a], i}
    <i data-k="row-{i}">{type(a).__name__}:{type(b).__name__}:{b is a}:{b == a}</i>
{/each}

<!-- And the branch Python does not take reads nothing: `second` is still in its
     temporal dead zone when the default of `first` runs. -->
{#each [[]] as [first=1 if True else second, second=2]}
    <i data-k="untaken">{first}:{second}</i>
{/each}

{#each [[]] as [first=1 or second, second=2]}
    <i data-k="short-circuit">{first}:{second}</i>
{/each}
