<script module>
    import Child from './InstanceChild.svelte';
</script>

<script lang="python">
# Four ways a parent can talk to a child, about one number. Three work. The
# fourth is the only one that asks the child to *be* an object the parent holds
# and calls, and that is the one Svelthon does not do yet.
seen = "nothing yet"
shared = 10
outcome = "not tried"
mine = None


def note(n):
    global seen
    seen = "the child moved to {}".format(n)


def focus_the_child():
    global outcome

    if mine is None:
        outcome = "bind:this never filled the name"
        return

    try:
        mine.focus()
        outcome = "the field is focused"
    except Exception as error:
        outcome = "{}: {}".format(type(error).__name__, error)


# Both sides, always: a prop is declared in the child and filled by the parent,
# and naming one without showing the other explains nothing.
here = "Instances.svelte      "
kid = "InstanceChild.svelte  "

code = {
    "down": kid + 'start: int = 0\n'
    + here + '<Child start={5} />',
    "up": kid + 'on_change: callable = None\n'
    + kid + 'on_change(count)              # called on every +1\n'
    + here + 'def note(n): ...\n'
    + here + '<Child on_change={note} />',
    "both": kid + 'count: int <=>\n'
    + here + '<Child bind:count={shared} />',
    "call": kid + 'def focus(): field.focus()   (nothing marks it public: the hole)\n'
    + here + '<Child bind:this={mine} />\n'
    + here + 'mine.focus()',
}
</script>

<h1>Talking to a child</h1>
<p class="lede">The same counter, four ways. Three are props. The fourth is not.</p>

<section>
    <h2>1. A prop carrying a number</h2>
    <code>{code["down"]}</code>
    <p class="what">It goes down, and the child counts from 5 instead of 0.</p>
    <div class="live"><Child start={5} /></div>
</section>

<section>
    <h2>2. A prop carrying a function</h2>
    <code>{code["up"]}</code>
    <p class="what">A function is a value like any other. The child calls it on every +1,
        which is how anything travels upward: Svelte 5 has no events, only this.</p>
    <div class="live">
        <Child on_change={note} />
        <p>the parent heard: <b>{seen}</b></p>
    </div>
</section>

<section>
    <h2>3. The same prop, read and written</h2>
    <code>{code["both"]}</code>
    <p class="what">
        The child's +1 moves the parent's value, and the parent's button moves the child's.
    </p>
    <div class="live">
        <Child bind:count={shared} />
        <p>
            the parent holds: <b>{shared}</b>
            <button onclick={lambda: (shared := 100)}>set it to 100 from here</button>
        </p>
    </div>
</section>

<section class="broken">
    <h2>4. Not a prop at all</h2>
    <code>{code["call"]}</code>
    <p class="what">
        Nothing is passed here. The parent wants the child to <b>do</b> something, and an
        act is not a value: a <code>should_focus</code> flag would have to be watched, acted
        on, then cleared. Svelte calls this the component's instance API. It is the only one
        of the four that is not a prop, and the only one missing.
    </p>
    <div class="live">
        <Child bind:this={mine} />
        <p>
            <button onclick={focus_the_child}>call mine.focus()</button>
            result: <b>{outcome}</b>
        </p>
        <p class="what">what bind:this gave us: <b>{type(mine).__name__}</b></p>
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
    .what {
        color: #666;
        font-size: 13px;
        margin: 0.4rem 0;
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
    :global(.child) {
        display: inline-block;
        border: 1px dashed #bbb;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
    }
</style>
