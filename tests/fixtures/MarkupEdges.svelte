<script lang="python">
# Markup Svelte accepts, written the way an author may: a comment at the end
# of an expression and of a block's head, a trailing comma in a pattern, and
# directive-looking words inside a quoted value.
count = 2
pairs = [[1, 2], [3, 4]]
name = "start"
row = {"label": "start"}
clicks = 0


def f(a, b):
    return a + b


def add(n):
    global clicks
    clicks += n
</script>

<p data-k="comment">{count  # the number of items
}</p>
<ul data-k="each-comment">{#each pairs as pair  # every pair
}<li>{pair[0]}</li>{/each}</ul>
<ul data-k="trailing">{#each pairs as [a, b,]}<li>{a}{b}</li>{/each}</ul>
{#snippet cell(a, b,)}<i data-k="snippet">{f(a, b)}</i>{/snippet}
{@render cell(1, 2)}
<input data-k="quoted" value="a bind:foo let:item b" />
<input data-k="bound-name" bind:value={name  # the visitor's name
} />
<input data-k="bound-label" bind:value={row.label  # shown
} />
<p data-k="model">{name}|{row["label"]}</p>
{#snippet word(text)}<em data-k="rendered">{text}</em>{/snippet}
{@render word(name)  # a friendly word
}
<button data-k="split" onclick={lambda:
    add(1)}>+1</button>
<button data-k="split-comment" onclick={lambda:  # on click
    add(10)}>+10</button>
<p data-k="clicks">{clicks}</p>
{#snippet sum(a, b)}<b data-k="split-render">{a + b}</b>{/snippet}
{@render sum(count +
    1, 5)}
<input data-k="split-bound" bind:value={row
    .label} />
