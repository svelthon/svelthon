<script module>
    import Py from './EffectPy.svelte';
    import Js from './EffectJs.svelte';
</script>

<script lang="python">
# The last of the four holes, and the only one that is a design question rather
# than an omission. An effect belongs to an owner; a function called at any
# moment has none. Svelte answers "whoever is initialising", and it can, because
# it has a current owner at run time. We wire at compile time and have none.
py_code = (
    "@effect\n"
    "def top(): ...              <- runs\n"
    "\n"
    "=> note(n)                  <- runs too, the arrow is the same thing unnamed\n"
    "\n"
    "def register():\n"
    "    @effect\n"
    "    def inner(): ...        <- silence\n"
    "\n"
    "register()"
)

js_code = (
    "$effect(() => …)          // runs\n"
    "\n"
    "function register() {\n"
    "    $effect(() => …)      // runs too\n"
    "}\n"
    "\n"
    "register()                // called while initialising\n"
    "\n"
    "onclick={() => $effect(…)} // refused: effect_orphan"
)
</script>

<h1>An effect made inside a function</h1>
<p class="lede">
    Press <b>+1</b> in each box: an effect that runs says so again with the new number.
</p>

<section>
    <h2>Svelthon</h2>
    <code>{py_code}</code>
    <div class="live"><Py /></div>
    <p class="what">
        The second one never runs, and nothing is said. The decorator is an identity at run
        time, so the function is built and wired to nothing.
    </p>
</section>

<section>
    <h2>Svelte, the same shapes</h2>
    <code>{js_code}</code>
    <div class="live"><Js /></div>
    <p class="what">
        Theirs runs, because a component being initialised is the current owner and
        <code>$effect</code> reads it at run time. Called later, from a click, there is no
        owner and Svelte refuses out loud rather than doing nothing.
    </p>
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
        margin: 0.7rem 0;
        border: 1px dashed #bbb;
        border-radius: 4px;
        padding: 0.5rem 0.7rem;
    }
</style>
