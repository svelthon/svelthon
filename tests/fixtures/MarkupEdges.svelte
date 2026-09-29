<script lang="python">
# Markup Svelte accepts, written the way an author may: a comment at the end
# of an expression and of a block's head, a trailing comma in a pattern, and
# directive-looking words inside a quoted value.
count = 2
pairs = [[1, 2], [3, 4]]


def f(a, b):
    return a + b
</script>

<p data-k="comment">{count  # the number of items
}</p>
<ul data-k="each-comment">{#each pairs as pair  # every pair
}<li>{pair[0]}</li>{/each}</ul>
<ul data-k="trailing">{#each pairs as [a, b,]}<li>{a}{b}</li>{/each}</ul>
{#snippet cell(a, b,)}<i data-k="snippet">{f(a, b)}</i>{/snippet}
{@render cell(1, 2)}
<input data-k="quoted" value="a bind:foo let:item b" />
