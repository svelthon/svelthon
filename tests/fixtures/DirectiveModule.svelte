<script lang="python">
# A directive naming a module: the value beside it is Python, but the name
# itself is read as JavaScript, where `import` binds nothing.
import directive_mod

flag = True
</script>

<p data-k="acted" use:directive_mod.mark>not yet</p>
<p data-k="valued" use:directive_mod.mark={{"speed": 2}}>not yet</p>
