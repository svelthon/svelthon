<script lang="python">
# The rows of a loop computed by a JavaScript function whose root's cleanup
# reads a state and calls a function of the script.
importjs { probe } from "./early_rows_driver.svelte.js"
rows = [1]
count = 7


def helper():
    return "h"
</script>

{#each probe(lambda: str(count) + helper(), rows) as row}<b>{row}</b>{/each}
