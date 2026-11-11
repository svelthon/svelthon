<script lang="python">
# One name declared in two blocks is two cells, two groups, however the
# binding spells it: in parentheses, before a comment, or in another spelling
# Python reads as the same name.
shared = ["B"]
</script>

{#if True}{picked = shared}<div data-pair="0"><input type="checkbox" value="A" bind:group={(picked)} /><p>{",".join(picked)}</p></div>{/if}
{#if True}{picked = shared}<div data-pair="0"><input type="checkbox" value="B" bind:group={(picked)} /><p>{",".join(picked)}</p></div>{/if}
{#if True}{chosen = shared}<div data-pair="1"><input type="checkbox" value="A" bind:group={chosen # kept
} /><p>{",".join(chosen)}</p></div>{/if}
{#if True}{chosen = shared}<div data-pair="1"><input type="checkbox" value="B" bind:group={chosen # kept
} /><p>{",".join(chosen)}</p></div>{/if}
{#if True}{ﬁeld = shared}<div data-pair="2"><input type="checkbox" value="A" bind:group={field} /><p>{",".join(ﬁeld)}</p></div>{/if}
{#if True}{ﬁeld = shared}<div data-pair="2"><input type="checkbox" value="B" bind:group={field} /><p>{",".join(ﬁeld)}</p></div>{/if}
