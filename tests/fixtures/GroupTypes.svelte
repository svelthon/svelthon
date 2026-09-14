<script lang="python">
# `bind:group` over values that are not strings. An element's `value` property
# is text, so the group action cannot read the author's value off the node: it
# has to be handed the one the expression evaluated to.
chosen = 2
picked = [1]
ratio = 0.5
</script>

{#each [1, 2, 3] as n}
    <input data-k="r-{n}" type="radio" bind:group={chosen} value={n} />
{/each}
<p data-k="chosen">{chosen}</p>
<p data-k="chosen-type">{type(chosen).__name__}</p>

{#each [1, 2, 3] as n}
    <input data-k="c-{n}" type="checkbox" bind:group={picked} value={n} />
{/each}
<p data-k="picked">{picked}</p>
<p data-k="picked-types">{[type(one).__name__ for one in picked]}</p>

<!-- A Brython float is an object, so two evaluations of the same literal are
     two objects: this one only passes if the comparison is Python's `==`. -->
{#each [0.5, 1.5] as f}
    <input data-k="f-{f}" type="radio" bind:group={ratio} value={f} />
{/each}
<p data-k="ratio">{ratio}</p>
<p data-k="ratio-type">{type(ratio).__name__}</p>

<!-- The value written before the binding rather than after it. -->
{#each [1, 2] as n}
    <input data-k="b-{n}" value={n} type="radio" bind:group={chosen} />
{/each}
