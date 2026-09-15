<script lang="python">
# The words the generated preamble imports from the runtime, used as an author
# would use them. They arrived bare in the component's own scope, so each of
# these lines gave `Identifier 'x' has already been declared` and the component
# did not compile. Five of them are names a Python author really writes.
group = "aucun"
follow = False
schedule = []
track = {"a": 1}


def init():
    global group
    group = "prêt"


def bind(one):
    return one * 2


NONE = "pas None"
ticking = 1
plainData = 2
jsCall = 3
</script>

<button data-k="init" onclick={init}>init()</button>
<p data-k="group">{group}</p>
<p data-k="follow">{follow}</p>
<p data-k="schedule">{schedule}</p>
<p data-k="track">{track["a"]}</p>
<p data-k="bind">{bind(21)}</p>
<p data-k="none">{NONE}</p>
<p data-k="rest">{ticking}{plainData}{jsCall}</p>
