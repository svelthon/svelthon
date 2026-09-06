<script module>
    import Card from './SnippetCard.svelte';
</script>

<script lang="python">
# What a snippet is for: writing a piece of markup once and rendering it where
# it is needed, with arguments. Five forms, live, in the order an author meets
# them. The code shown is held as strings so the braces reach the page instead
# of being read as template expressions.
people = ["ada", "grace"]

# Written out in full, bodies included: the output below is only readable if the
# markup that produced it is on screen. `here` is this file, `card` is the child.
here = "Snippets.svelte     "
card = "SnippetCard.svelte  "

code = {
    "one": here + '{#snippet hello()}<b>reused</b>{/snippet}\n'
    + here + '{@render hello()}',
    "two": here + '{#snippet loud(who)}<b>{who.upper()}</b>{/snippet}\n'
    + here + '{@render loud("ada")} {@render loud(people[1])}',
    "three": here + '<Card>{#snippet row(x)}<b>row says {x}</b>{/snippet}</Card>\n'
    + card + '{#if row is not None}{@render row("from the child")}{/if}',
    "four": here + '<Card>plain text</Card>\n'
    + card + '{#if children is not None}{@render children()}{/if}',
    "five": here + '<Card>\n'
    + here + '    {#snippet header(x)}<b>header({x})</b>{/snippet}\n'
    + here + '    {#snippet row(x)}<b>row({x})</b>{/snippet}\n'
    + here + '    and whatever is left over\n'
    + here + '</Card>\n'
    + card + '{#if children is not None}{@render children()}{/if}\n'
    + card + '{#if row is not None}{@render row("from the child")}{/if}\n'
    + card + '{#if header is not None}{@render header("from the child")}{/if}',
    "five_b": here + '<Card>{#snippet children()}<b>named by hand</b>{/snippet}</Card>\n'
    + card + '{#if children is not None}{@render children()}{/if}',
    "six": here + '{#snippet row(x)}<b>row says {x}</b>{/snippet}\n'
    + here + '<Card {row} />\n'
    + card + '{#if row is not None}{@render row("from the child")}{/if}',
    "seven": here + '{#snippet row(x)}<b>row says {x}</b>{/snippet}\n'
    + here + '<Card header={row} />\n'
    + card + '{#if header is not None}{@render header("from the child")}{/if}',
}

# What the two broken forms would print if the name resolved. Both are the same
# string, and it is the one case 3 already prints: same child, same snippet,
# same argument, only the place where the snippet is written differs.
want = "row says from the child"

# The comparison at the end. The child is identical on both sides, so it is
# printed once above the two columns rather than in each.
shared = card + '{#if row is not None}{@render row("from the child")}{/if}'

inside = here + '<Card>\n' + here + '    {#snippet row(x)}<b>row says {x}</b>{/snippet}\n' + here + '</Card>'

beside = here + '{#snippet row(x)}<b>row says {x}</b>{/snippet}\n' + here + '<Card {row} />'
</script>

{#snippet hello()}<b>reused</b>{/snippet}

{#snippet loud(who)}<b>{who.upper()}</b>{/snippet}

{#snippet row(x)}<b>row says {x}</b>{/snippet}

<h1>Snippets</h1>
<p class="lede">Reusing a piece of markup. What works, and where it stops.</p>

<section>
    <h2>1. Declared and rendered in the same component</h2>
    <code>{code["one"]}</code>
    <div class="live">{@render hello()}</div>
</section>

<section>
    <h2>2. The same, with a parameter</h2>
    <code>{code["two"]}</code>
    <div class="live">{@render loud("ada")} {@render loud(people[1])}</div>
</section>

<section>
    <h2>3. Declared inside a child, which renders it</h2>
    <code>{code["three"]}</code>
    <div class="live">
        <Card>
            {#snippet row(x)}<b>row says {x}</b>{/snippet}
        </Card>
    </div>
</section>

<section>
    <h2>4. The child's content, which is a snippet called <em>children</em></h2>
    <code>{code["four"]}</code>
    <div class="live"><Card>plain text</Card></div>
</section>

<section>
    <h2>5. Several at once, and what is left over</h2>
    <code>{code["five"]}</code>
    <div class="live">
        <Card>
            {#snippet header(x)}<b>header({x})</b>{/snippet}
            {#snippet row(x)}<b>row({x})</b>{/snippet}
            and whatever is left over
        </Card>
    </div>
</section>

<section>
    <h2>5b. The leftover, named by hand</h2>
    <code>{code["five_b"]}</code>
    <div class="live">
        <Card>
            {#snippet children()}<b>named by hand</b>{/snippet}
        </Card>
    </div>
</section>

<section class="broken">
    <h2>6. Declared here, handed over by its name</h2>
    <code>{code["six"]}</code>
    <div class="live">
        <svelte:boundary>
            <Card {row} />
            {#snippet failed(error, reset)}<span class="err">{error}</span>{/snippet}
        </svelte:boundary>
        <p class="want">expected: <b>{want}</b></p>
    </div>
</section>

<section class="broken">
    <h2>7. The same, under another name</h2>
    <code>{code["seven"]}</code>
    <div class="live">
        <svelte:boundary>
            <Card header={row} />
            {#snippet failed(error, reset)}<span class="err">{error}</span>{/snippet}
        </svelte:boundary>
        <p class="want">expected: <b>{want}</b></p>
    </div>
</section>

<section class="compare">
    <h2>8. The two side by side</h2>
    <p class="lede">Same child, same snippet, same argument, same expected output. The only
        difference is where the snippet is written.</p>
    <code>{shared}</code>
    <div class="pair">
        <div>
            <h3>written inside the tag</h3>
            <code>{inside}</code>
            <div class="live">
                <Card>
                    {#snippet row(x)}<b>row says {x}</b>{/snippet}
                </Card>
            </div>
        </div>
        <div>
            <h3>written beside it, passed by name</h3>
            <code>{beside}</code>
            <div class="live">
                <svelte:boundary>
                    <Card {row} />
                    {#snippet failed(error, reset)}<span class="err">{error}</span>{/snippet}
                </svelte:boundary>
            </div>
        </div>
    </div>
</section>

<style>
    :global(body) {
        font: 15px/1.6 system-ui, sans-serif;
        margin: 0 auto;
        padding: 2rem;
        max-width: 46rem;
    }
    h1 {
        margin-bottom: 0;
    }
    .lede {
        color: #666;
        margin-top: 0.2rem;
    }
    section {
        border-top: 1px solid #ddd;
        padding: 1rem 0;
    }
    h2 {
        font-size: 1rem;
        margin: 0 0 0.5rem;
    }
    code {
        display: block;
        background: #f4f4f4;
        padding: 0.5rem 0.7rem;
        border-radius: 4px;
        font-size: 13px;
        white-space: pre;
        overflow-x: auto;
    }
    .live {
        margin-top: 0.7rem;
    }
    .broken h2::after {
        content: ' (cassé)';
        color: #b00;
        font-weight: normal;
    }
    .pair {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-top: 0.8rem;
    }
    .pair h3 {
        font-size: 13px;
        font-weight: 600;
        margin: 0 0 0.4rem;
        color: #444;
    }
    .want {
        margin: 0.4rem 0 0;
        color: #666;
        font-size: 13px;
    }
    .err {
        color: #b00;
        font-family: ui-monospace, monospace;
        font-size: 13px;
    }
    :global(.card) {
        border: 1px dashed #bbb;
        padding: 0.5rem 0.7rem;
        border-radius: 4px;
    }
</style>
