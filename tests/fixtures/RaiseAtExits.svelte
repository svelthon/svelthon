<script module>
import { through } from './through.js';
</script>
<script lang="python">
# Python raising at the exit `where` names, where Svelte calls it (`on_mount`,
# `on_destroy`, an action) or JavaScript does (an export); and an `except`
# around a JavaScript function that calls back Python which raises, imported
# and read off the page's globals.
where: str = "nowhere"
seen = ""


def on_mount():
    if where == "on_mount":
        raise ValueError("on_mount")


def on_destroy():
    if where == "on_destroy":
        raise ValueError("on_destroy")


def act(node):
    if where == "action":
        raise ValueError("action")


@export
def boom():
    raise ValueError("export")


def guarded():
    global seen
    caught = []
    for call in (through, js.globalThrough):
        try:
            call(boom)
        except ValueError as error:
            caught.append(type(error).__name__)
    seen = " ".join(caught)
</script>

<p use:act>exits</p>
<button data-k="guarded" onclick={guarded}>guarded</button>
<p data-k="seen">{seen}</p>
