<script module>
    import Child from './InstanceChild.svelte';
</script>

<script lang="python">
# Four ways a parent and a child can talk, and the one that is missing. The three
# that work need no reference to the child at all; the fourth is the only one
# that asks the child to *be* something a parent can hold and call.
mine = None
said = "nothing yet"
shared = ""
outcome = "not tried"


def note(what):
    global said
    said = what


def probe():
    global outcome

    if mine is None:
        outcome = "bind:this never filled the name"
        return

    try:
        outcome = mine.shout()
    except Exception as error:
        outcome = "{}: {}".format(type(error).__name__, error)


code = {
    "down": '<Child label="one" />',
    "up": '<Child told={note} />        def note(what): ...',
    "both": '<Child bind:heard={shared} />',
    "call": '<Child bind:this={mine} />    mine.shout()',
}
</script>

<h1>Talking to a child</h1>
<p class="lede">What a parent can already do, and the one thing it cannot.</p>

<section>
    <h2>1. A prop going down</h2>
    <code>{code["down"]}</code>
    <div class="live"><Child label="one" /></div>
</section>

<section>
    <h2>2. A callback going up</h2>
    <code>{code["up"]}</code>
    <div class="live">
        <Child label="two" told={note} />
        <p>the parent heard: <b>{said}</b></p>
    </div>
</section>

<section>
    <h2>3. A bindable going both ways</h2>
    <code>{code["both"]}</code>
    <div class="live">
        <Child label="three" bind:heard={shared} />
        <p>the parent holds: <b>{shared if shared else "nothing"}</b></p>
    </div>
</section>

<section class="broken">
    <h2>4. Calling a method on the instance</h2>
    <code>{code["call"]}</code>
    <div class="live">
        <Child label="four" bind:this={mine} />
        <p>
            <button onclick={probe}>call mine.shout()</button>
            result: <b>{outcome}</b>
        </p>
        <p class="what">the reference itself: <b>{type(mine).__name__}</b></p>
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
    h2 {
        font-size: 1rem;
        margin: 0 0 0.5rem;
    }
    .lede {
        color: #666;
        margin-top: 0.2rem;
    }
    section {
        border-top: 1px solid #ddd;
        padding: 1rem 0;
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
    .what {
        color: #666;
        font-size: 13px;
    }
    :global(.child) {
        border: 1px dashed #bbb;
        padding: 0.4rem 0.6rem;
        border-radius: 4px;
    }
</style>
