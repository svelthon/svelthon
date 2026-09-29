<script lang="python">
# A directive naming a module: the value beside it is Python, but the name
# itself is read as JavaScript, where `import` binds nothing.
import directive_mod

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
