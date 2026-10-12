<script module>
    import Py from './EffectPy.svelte';
    import Js from './EffectJs.svelte';
</script>

<script lang="python">
# An effect belongs to an owner, and a function called at any moment has none.
# Svelte answers "whoever is initialising", and it can, because it has a current
# owner at run time. Svelthon wires effects at compile time and has none, so an
# effect is written at the top of the component and refused anywhere else.
py_code = (
    "@effect\n"
    "def top(): ...              <- runs\n"
    "\n"
    "=> note(n)                  <- runs too, the arrow is the same thing unnamed\n"
    "\n"
    "def register():\n"
    "    @effect\n"
    "    def inner(): ...        <- refused, see below\n"
    "\n"
    "register()"
)

refusal = (
    "svelthon — a rune belongs at the top level of the module,\n"
    "           and `@effect` is only read there (App.svelte:9)"
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

<p class="back"><a href="./">← Svelthon</a></p>

<h1>An effect made inside a function</h1>
<p class="lede">
    Press <b>+1</b> in each box: an effect that runs says so again with the new number.
</p>

<section>
    <h2>Svelthon</h2>
    <code>{py_code}</code>
    <div class="live"><Py /></div>
    <p class="what">Both spellings run at the top. Written inside a function, a rune is
        built and wired to nothing, so it is refused rather than shipped silent:</p>
    <code class="err">{refusal}</code>
    <p class="what">
        The arrow is refused there by its indentation, the decorator by this message. A
        rune lives at the top level of a component's module, and nowhere else.
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
    .back {
        margin: 0 0 1rem;
        font-size: 13px;
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
    .err {
        background: #fff4f4;
        color: #b00;
    }
    .live {
        margin: 0.7rem 0;
        border: 1px dashed #bbb;
        border-radius: 4px;
        padding: 0.5rem 0.7rem;
    }
</style>
