<script lang="python">
# Decorators imported from JavaScript under the names of two markers: the
# library's, which hand the function back, and no rune of ours.
importjs {derived, effect} from "./imported_decorators.js"

ran = 0


@derived
def answer():
    return 42


@effect
def side():
    global ran
    ran += 1
    return ran
</script>

<p data-k="answer">{answer()}</p>
<p data-k="ran">{ran}</p>
