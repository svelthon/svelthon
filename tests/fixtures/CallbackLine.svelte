<!--
    Markup above the script, so the script's lines are not the file's: the
    `raise` below is line 16 of this file. A callback a library keeps has to
    be placed in the file all the same, and a handler from a module in the
    module's.
-->
<p>ready</p>

<script lang="python">
importjs {keep} from './kept_callback.js'
import handler_store
import handler_reactive


def fail():
    raise ValueError("kept callback failure")


keep(fail)


@export
def direct():
    return fail()
</script>

<button data-k="store" onclick={handler_store.boom}>store</button>
<button data-k="reactive" onclick={handler_reactive.boom}>reactive</button>
