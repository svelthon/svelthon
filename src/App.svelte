<script>
    import Counter from './Counter.svelte';
    import Greeting from './Greeting.svelte';
    import Semantics from './Semantics.svelte';
    import StoreDemo from './StoreDemo.svelte';
    import Highlight from './Highlight.svelte';

    // The sources shown are the files themselves — nothing to keep in sync, and
    // the reader sees the whole component: the Python *and* the markup that
    // wires it to the DOM.
    import counterSrc from './Counter.svelte?raw';
    import greetingSrc from './Greeting.svelte?raw';
    import storeSrc from './lib/counter_store.py?raw';
    import storeDemoSrc from './StoreDemo.svelte?raw';
    import semanticsSrc from './Semantics.svelte?raw';
</script>

<main>
    <header class="hero">
        <p class="eyebrow">Python · Svelte 5 · Vite</p>
        <h1>SVELTHON</h1>
        <p class="lede">
            Svelte components written in Python, compiled at build time. No runes, no reactivity
            API — plain Python. The browser receives only JavaScript.
        </p>
    </header>

    <article class="demo">
        <div class="head">
            <h2>Reactivity</h2>
            <p>Assign to a name and the DOM follows. That is the entire API.</p>
        </div>
        <div class="body">
            <div class="files"><div class="code"><span class="tag">Counter.svelte</span><pre><code><Highlight file="Counter.svelte" code={counterSrc} /></code></pre></div></div>
            <div class="live"><div class="row"><Counter /></div></div>
        </div>
    </article>

    <article class="demo">
        <div class="head">
            <h2>Props</h2>
            <p>An annotation declares the interface, like a dataclass field. A bare assignment stays
                internal. The two instances differ by one attribute — the second overrides the
                default.</p>
        </div>
        <div class="body">
            <div class="files"><div class="code"><span class="tag">Greeting.svelte</span><pre><code><Highlight file="Greeting.svelte" code={greetingSrc} /></code></pre></div></div>
            <div class="live pair">
                <div>
                    <span class="tag">&lt;Greeting name="Ada" /&gt;</span>
                    <div class="row"><Greeting name="Ada" /></div>
                </div>
                <div>
                    <span class="tag">&lt;Greeting name="Ada" punct="?" /&gt;</span>
                    <div class="row"><Greeting name="Ada" punct="?" /></div>
                </div>
            </div>
        </div>
    </article>

    <article class="demo">
        <div class="head">
            <h2>Shared state</h2>
            <p>A plain <code>.py</code> file. Its names become signals created once for the whole
                application — both components below read the same counter.</p>
        </div>
        <div class="body">
            <div class="files"><div class="code"><span class="tag">counter_store.py</span><pre><code><Highlight file="counter_store.py" code={storeSrc} /></code></pre></div><div class="code"><span class="tag">StoreDemo.svelte — how a component uses it</span><pre><code><Highlight file="StoreDemo.svelte" code={storeDemoSrc} /></code></pre></div></div>
            <div class="live pair">
                <div><span class="tag">instance A</span><div class="row"><StoreDemo /></div></div>
                <div><span class="tag">instance B</span><div class="row"><StoreDemo /></div></div>
            </div>
        </div>
    </article>

    <article class="demo">
        <div class="head">
            <h2>Real Python semantics</h2>
            <p>Not a Python-flavoured dialect: CPython's grammar and object model, all the way
                down. Each comment on the left is what JavaScript would have produced instead.</p>
        </div>
        <div class="body">
            <div class="files"><div class="code"><span class="tag">Semantics.svelte</span><pre><code><Highlight file="Semantics.svelte" code={semanticsSrc} /></code></pre></div></div>
            <div class="live stack"><Semantics /></div>
        </div>
    </article>

    <footer>
        <span><strong>244 KB</strong> gzip, runtime included</span>
        <span><strong>69</strong> tests</span>
        <span><strong>0 ms</strong> compiling at load</span>
    </footer>
</main>

<style>
    :global(:root) {
        --bg: #fbfaf9;
        --surface: #ffffff;
        --code-bg: #f6f4f1;
        --border: #e7e3de;
        --text: #1b1a19;
        --muted: #6e6a65;
        --accent: #ff3e00;
        --c-kw: #1e5aa8;
        --c-fn: #a14e12;
        --c-str: #3f7d3f;
        --c-num: #8a6d1f;
        --c-bi: #6b4fa8;
        --c-op: #8b857e;
        --c-com: #97918a;
        --c-tag: #1e5aa8;
        --c-attr: #6b4fa8;
        color-scheme: light dark;
    }

    @media (prefers-color-scheme: dark) {
        :global(:root) {
            --bg: #131313;
            --surface: #191919;
            --code-bg: #0f0f0f;
            --border: #2b2a28;
            --text: #eceae7;
            --muted: #97928c;
            --c-kw: #7aa9e6;
            --c-fn: #e0955a;
            --c-str: #8cc48c;
            --c-num: #d4b872;
            --c-bi: #b39ae0;
            --c-op: #8b857e;
            --c-com: #6f6a64;
            --c-tag: #7aa9e6;
            --c-attr: #b39ae0;
        }
    }

    :global(body) {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
    }

    main {
        max-width: 60rem;
        margin: 0 auto;
        padding: clamp(2rem, 6vw, 5rem) 1.25rem 4rem;
    }

    .hero {
        margin-bottom: 3.5rem;
    }

    .eyebrow {
        margin: 0;
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--muted);
    }

    h1 {
        margin: 0.4rem 0 0;
        font-size: clamp(2.6rem, 8vw, 4rem);
        font-weight: 800;
        letter-spacing: -0.035em;
        line-height: 1;
        background: linear-gradient(100deg, var(--accent), #ff8a3d);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
    }

    .lede {
        max-width: 34rem;
        margin: 1rem 0 0;
        font-size: 1.12rem;
        color: var(--muted);
        text-wrap: pretty;
    }

    .demo {
        margin-bottom: 1.5rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 14px;
        overflow: hidden;
    }

    .head {
        padding: 1.15rem 1.4rem;
        border-bottom: 1px solid var(--border);
    }

    .head h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 650;
        letter-spacing: -0.01em;
    }

    .head p {
        margin: 0.3rem 0 0;
        font-size: 0.92rem;
        color: var(--muted);
        text-wrap: pretty;
    }

    .body {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    }

    /* One column, however many files it holds. */
    .files {
        background: var(--code-bg);
        border-right: 1px solid var(--border);
        min-width: 0;
    }

    .code + .code {
        border-top: 1px solid var(--border);
    }

    pre {
        margin: 0;
        padding: 0 1.4rem 1.25rem;
        overflow-x: auto;
    }

    .tag {
        display: block;
        padding: 0.75rem 1.4rem 0.5rem;
        font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        font-size: 0.72rem;
        letter-spacing: 0.02em;
        color: var(--muted);
    }

    .pair {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1rem;
        align-items: start;
    }

    .pair .tag {
        padding: 0 0 0.35rem;
    }

    .pair > div {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 0.5rem;
    }

    code {
        font-family: ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, monospace;
        font-size: 0.84rem;
        line-height: 1.65;
    }

    .head code {
        padding: 0.1em 0.35em;
        background: var(--code-bg);
        border-radius: 4px;
        font-size: 0.86em;
    }

    .live {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        gap: 0.7rem;
        padding: 1.25rem 1.4rem;
    }

    /* Button then value, side by side: inside the button the pointer sits right
       on top of the digit that changes. */
    .live :global(output) {
        display: block;
        font-family: ui-monospace, 'SF Mono', Menlo, monospace;
        font-size: 0.92rem;
        font-variant-numeric: tabular-nums;
        color: var(--text);
        overflow-wrap: anywhere;
    }

    /* Une ligne de résultat par ligne de source : le rythme suit celui du code. */
    .stack {
        gap: 0.3rem;
    }

    .row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
    }

    /* The demo components stay minimal on purpose — their markup is the point,
       not their styling, so the page dresses them from here. */
    .live :global(p) {
        margin: 0;
        font-size: 0.95rem;
        font-variant-numeric: tabular-nums;
        overflow-wrap: anywhere;
    }

    .live :global(button) {
        padding: 0.42rem 0.85rem;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: var(--accent);
        color: #fff;
        font: inherit;
        font-size: 0.9rem;
        font-weight: 550;
        min-width: 2.6rem;
        border-color: transparent;
        cursor: pointer;
        transition: filter 0.12s ease;
    }

    .live :global(button:hover) {
        filter: brightness(1.08);
    }

    footer {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 2rem;
        margin-top: 2.5rem;
        padding-top: 1.5rem;
        border-top: 1px solid var(--border);
        font-size: 0.9rem;
        color: var(--muted);
    }

    footer strong {
        color: var(--text);
        font-variant-numeric: tabular-nums;
    }

    @media (max-width: 46rem) {
        .body {
            grid-template-columns: 1fr;
        }

        pre {
            border-right: none;
            border-bottom: 1px solid var(--border);
        }
    }
</style>
