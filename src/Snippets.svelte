<script module>
    import Card from './SnippetCard.svelte';
</script>

<script lang="python">
# What a snippet is for: writing a piece of markup once and rendering it where
# it is needed, with arguments. Five forms, live, in the order an author meets
# them. The code shown is held as strings so the braces reach the page instead
# of being read as template expressions.
people = ["ada", "grace"]

code = {
    "one": '{#snippet hello()}...{/snippet}   {@render hello()}',
    "two": '{#snippet loud(who)}...{/snippet}   {@render loud("ada")}',
    "three": '<Card>{#snippet row(x)}...{/snippet}</Card>',
    "four": '<Card>plain text</Card>',
    "five": '{#snippet row(x)}...{/snippet}   <Card {row} />',
    "six": '{#snippet row(x)}...{/snippet}   <Card header={row} />',
}
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

<section class="broken">
    <h2>5. Declared here, handed over by its name</h2>
    <code>{code["five"]}</code>
    <div class="live">
        <svelte:boundary>
            <Card {row} />
            {#snippet failed(error, reset)}<span class="err">{error}</span>{/snippet}
        </svelte:boundary>
    </div>
</section>

<section class="broken">
    <h2>6. The same, under another name</h2>
    <code>{code["six"]}</code>
    <div class="live">
        <svelte:boundary>
            <Card header={row} />
            {#snippet failed(error, reset)}<span class="err">{error}</span>{/snippet}
        </svelte:boundary>
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
