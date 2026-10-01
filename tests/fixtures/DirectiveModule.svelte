<script lang="python">
# A directive naming a module: the value beside it is Python, but the name
# itself is read as JavaScript, where `import` binds nothing.
import directive_mod
import directive_mod as actions
from directive_mod import measured
from directive_mod import measured as action

flag = True
half: float = 0.5
whole: int = 1


def local(node, value):
    # The same action written in the component, which is the other wrapper and
    # had the same hole.
    node.textContent = format(value, ".2f")
</script>

<p data-k="acted" use:directive_mod.mark>not yet</p>
<p data-k="valued" use:directive_mod.mark={{"speed": 2}}>not yet</p>
<p data-k="async" use:directive_mod.later>not yet</p>

<!-- A fractional parameter, through both wrappers, with an integer beside it:
     JavaScript hands the same kind of value for 1 and 0.5, and Brython does
     not. -->
<p data-k="module-half" use:directive_mod.measured={half}>not yet</p>
<p data-k="module-whole" use:directive_mod.measured={whole}>not yet</p>
<p data-k="local-half" use:local={half}>not yet</p>
<p data-k="local-whole" use:local={whole}>not yet</p>

<!-- The name an import binds, and a path through an object of the module. -->
<p data-k="alias" use:actions.measured={half}>not yet</p>
<p data-k="member" use:measured={half}>not yet</p>
<p data-k="member-alias" use:action={half}>not yet</p>
<p data-k="instance" use:directive_mod.configured.measured={half}>not yet</p>
<p data-k="registry" use:directive_mod.registry.measured={half}>not yet</p>
