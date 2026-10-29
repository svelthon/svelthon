<script lang="python">
# An exported name a decorator binds to a JavaScript function.
importjs { two } from "./foreign_two.js"


def choose(fn):
    return two


@export
@choose
def action(*args):
    return 0
</script>

<p>ready</p>
