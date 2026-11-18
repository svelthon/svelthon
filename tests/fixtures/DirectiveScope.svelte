<script lang="python">
# Directives whose callee or whose options no earlier test reached: a name the
# markup declared, options in a container, an export the module replaces.
importjs { mark, replace, native_options, leased, first, second } from './directive_live.js'


def measured(node, value):
    node.textContent = format(value, ".2f")


def options_action(node, options):
    node.textContent = format(options["amount"], ".2f") + "/" + format(options["nested"]["amount"], ".2f")


class Actions:
    def measured(self, node, value):
        node.textContent = format(value, ".2f")


configured = Actions()
functions = [measured]
methods = [configured.measured]
options = {"amount": 0.5, "nested": {"amount": 0.25}}
js_options = {"nested": {"amount": 0.5}, "values": [0.25]}
shown = True
lease = 0.5


def renew():
    global lease
    lease = 0.75


# The callee changes and the value does not; an action left out with None.
chosen = first
amount = 0.5
maybe = None


def swap_action():
    global chosen
    chosen = second


def move():
    global amount
    amount = 0.75


def nudge():
    global amount
    amount = 1.0


def grow():
    global js_options
    js_options = {"nested": {"amount": 0.75}, "values": [0.125]}


def swap():
    global shown
    replace()
    shown = False


def show():
    global shown
    shown = True
</script>

{#each functions as act}<p data-k="each" use:act={0.5}>not yet</p>{/each}
{#each methods as act}<p data-k="method" use:act={0.5}>not yet</p>{/each}
{#if True}
    {act = configured.measured}
    <p data-k="declared" use:act={0.5}>not yet</p>
{/if}
{#snippet row(act)}<p data-k="snippet" use:act={0.5}>not yet</p>{/snippet}
{@render row(measured)}

<p data-k="python-options" use:options_action={options}>not yet</p>
<p data-k="js-options" use:native_options={js_options}>not yet</p>

<p data-k="lease" use:leased={lease}>not yet</p>

<p data-k="counted" use:chosen={amount}>not yet</p>
<p data-k="counted-bare" use:chosen>not yet</p>
<p data-k="counted-same" use:chosen={amount > 0}>not yet</p>
<p data-k="maybe" use:maybe={0.5}>not yet</p>
<button data-k="swap-action" onclick={swap_action}>swap action</button>
<button data-k="move" onclick={move}>move</button>
<button data-k="nudge" onclick={nudge}>nudge</button>
<button data-k="renew" onclick={renew}>renew</button>

<button data-k="grow" onclick={grow}>grow</button>
<button data-k="swap" onclick={swap}>swap</button>
<button data-k="show" onclick={show}>show</button>
{#if shown}<p data-k="live" use:mark>not yet</p>{/if}
