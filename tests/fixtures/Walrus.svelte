<script lang="python">
# `(name := value)` is the one assignment Python allows inside an expression, so
# the one a handler can hold. Here it writes the component's name.
open = False
tab = "code"
count = 0
picked = "none"

tabs = ["code", "js", "css"]
</script>

<button data-k="toggle" onclick={lambda: (open := not open)}>menu</button>
<button data-k="reset" onclick={lambda: (count := 0)}>reset</button>
<button data-k="plus" onclick={lambda: (count := count + 1)}>+1</button>

{#each tabs as one}
    <button data-k="tab-{one}" onclick={lambda: (tab := one)}>{one}</button>
{/each}

<button data-k="two" onclick={lambda: (picked := tab) and (count := len(tab))}>two</button>

<p data-k="open">{open}</p>
<p data-k="tab">{tab}</p>
<p data-k="count">{count}</p>
<p data-k="picked">{picked}</p>
