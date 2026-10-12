<script module>
    // A JavaScript action, the way an author writes one today.
    export function jsMark(node) {
        node.textContent = 'the js action ran';
    }
</script>

<script lang="python">
# What a directive names is a function: one from JavaScript, a def of this
# component, or a def of a Python module, named with its dot. Each row below
# names one of them, and each one runs.
importjs {fly} from "svelte/transition"

import directive_probe

shown = False


def act(node, options=None):
    node.textContent = "the local action ran"


def local_typewriter(node, params):
    text = node.textContent
    duration = len(text) * 30

    def tick(t, u):
        node.textContent = text[: int(len(text) * t)]

    return {"duration": duration, "tick": tick}


def toggle():
    global shown
    shown = not shown


code = {
    "js": 'use:jsMark          a function from <script module>',
    "local": 'use:act             a def in this component',
    "dotted": 'use:directive_probe.mark    a def in a Python module',
    "fly": 'transition:fly      importjs {fly} from "svelte/transition"',
    "localt": 'in:local_typewriter    a def in this component',
    "dottedt": 'in:directive_probe.typewriter    a def in a Python module',
}
</script>

<p class="back"><a href="./">← Svelthon</a></p>

<h1>Directives</h1>
<p class="lede">What a directive <em>names</em>, as opposed to what it is given.</p>

<h2>Actions, which run at mount</h2>

<section>
    <code>{code["js"]}</code>
    <p class="live" use:jsMark>nothing happened</p>
</section>

<section>
    <code>{code["local"]}</code>
    <p class="live" use:act>nothing happened</p>
</section>

<section>
    <code>{code["dotted"]}</code>
    <p class="live" use:directive_probe.mark>nothing happened</p>
</section>

<h2>Transitions, which run on insertion</h2>

<button onclick={toggle}>{"hide" if shown else "show"}</button>

<section>
    <code>{code["fly"]}</code>
    <div class="live">{#if shown}<p transition:fly={{"y": 8, "duration": 400}}>flown</p>{/if}</div>
</section>

<section>
    <code>{code["localt"]}</code>
    <div class="live">{#if shown}<p in:local_typewriter>typed by the component</p>{/if}</div>
</section>

<section>
    <code>{code["dottedt"]}</code>
    <div class="live">{#if shown}<p in:directive_probe.typewriter>typed by the module</p>{/if}</div>
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
        margin: 2rem 0 0;
    }
    .lede {
        color: #666;
        margin-top: 0.2rem;
    }
    section {
        border-top: 1px solid #ddd;
        padding: 0.8rem 0;
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
        margin: 0.6rem 0 0;
        min-height: 1.6em;
    }
    button {
        margin-top: 0.8rem;
    }
</style>
