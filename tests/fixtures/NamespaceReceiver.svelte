<script lang="python">
# Functions of a JavaScript namespace that read `this`: called with none, on
# the namespace, as the script calls them; called on an element, as Svelte
# calls a handler, on that one.
importjs * as actions from "./namespace_receiver.js"


def scripted():
    return actions.who()
</script>

<output data-k="dot">{actions.who()}</output>
<output data-k="getattr">{getattr(actions, "who")()}</output>
<output data-k="script">{scripted()}</output>
<div data-k="action" use:actions.stamp={3.5}></div>
<button data-k="handler" onclick={actions.clicked}>click</button>
{#each [actions] as {clicked=None}}<button data-k="each-default" onclick={clicked}><span>click</span></button>{/each}
{#snippet held({clicked=None})}<button data-k="snippet-default" onclick={clicked}><span>click</span></button>{/snippet}
{@render held(actions)}
