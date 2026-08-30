<script lang="python">
# Every mount of the child subscribes to the store's list, and no unmount ever
# unsubscribes. `alive` is the roll call the children keep, and is right;
# `subscribed` is what the list itself believes, and only ever goes up.
importjs LeakChild from "./LeakChild.svelte"
importjs {watchers} from "./watchers.js"
import leak_store

shown = True


@derived
def alive():
    return len(leak_store.live)


@derived
def subscribed():
    # Read the roll call so this recomputes when a child comes or goes:
    # `watchers()` is a plain JavaScript call and carries no signal of its own.
    len(leak_store.live)
    return watchers()


def toggle():
    global shown
    shown = not shown
</script>

<button onclick={toggle}>{"unmount the child" if shown else "mount the child"}</button>
{#if shown}<LeakChild />{/if}

<p>children alive: <strong data-k="alive">{alive}</strong></p>
<p>subscribers the list believes in: <strong data-k="subscribed">{subscribed}</strong></p>
<p><small>One subscriber is the store itself and never goes away. The rest should
follow the children — and never leave.</small></p>
