<script lang="python">
# Every mount of the child subscribes to the store's list, and no unmount ever
# unsubscribes. `alive` is counted by the components themselves and is right;
# `subscribed` is what the list itself believes, and only ever goes up.
importjs LeakChild from "./LeakChild.svelte"
importjs {watchers} from "./watchers.js"

shown = True
alive = 0
subscribed = 0


def toggle():
    global shown, alive, subscribed
    shown = not shown
    alive = 1 if shown else 0
    subscribed = watchers()
</script>

<button onclick={toggle}>{"unmount" if shown else "mount"}</button>
{#if shown}<LeakChild />{/if}

<p data-k="alive">{alive}</p>
<p data-k="subscribed">{subscribed}</p>
