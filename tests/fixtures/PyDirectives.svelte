<script module>
    import { fly } from 'svelte/transition';
    import { linear } from 'svelte/easing';

    // An action is a JavaScript function Svelte calls with the node — the
    // directive names it, the value only carries its options.
    export function mark(node, options) {
        node.dataset.mark = `${options["label"]}:${options["level"]}`;

        return {
            update(next) {
                node.dataset.mark = `${next["label"]}:${next["level"]}`;
            }
        };
    }
</script>

<script lang="python">
# Every directive here takes its value in Python. `use:` and `transition:` name
# their function in the directive, so the value is only an options dict — and a
# Brython dict exposes its keys as JavaScript properties, which is what lets
# Svelte read it.
items = []
flag = True
shade = "red"
level = 1

options = {"label": "boot", "level": level}


def add():
    items.append(len(items))


def raise_level():
    global level, options
    level += 1
    options = {"label": "boot", "level": level}
</script>

<!-- class: is read for truthiness, so it needs Python's: an empty list is
     false here and true in JavaScript. -->
<p data-k="empty" class:many={items}>empty</p>
<p data-k="counted" class:many={len(items) > 2}>counted</p>
<p data-k="flagged" class:on={flag}>flagged</p>

<!-- style: takes a value, and a conditional expression is Python's. -->
<p data-k="styled" style:color={shade if flag else "blue"}>styled</p>

<!-- use: with a Python dict for options, and update() when it changes. -->
<p data-k="acted" use:mark={options}>acted</p>

{#if flag}
    <p data-k="flown" transition:fly={{"y": 20, "duration": 1, "easing": linear}}>flown</p>
{/if}

<button data-k="add" onclick={add}>add</button>
<button data-k="raise" onclick={raise_level}>raise</button>
