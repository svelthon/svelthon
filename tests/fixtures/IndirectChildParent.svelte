<script lang="python">
# Children reached through a module that re-exports them, or through a
# namespace: no file the compiler reads tells their language, and they are
# told apart once mounted.
importjs { PythonChild, NativeChild } from './reexported_children.js'
importjs * as Bundle from './ShadowedPythonChild.svelte'

value = 15.0
</script>

<span data-k="re-exported python"><PythonChild value={value} /></span>
<span data-k="re-exported native"><NativeChild value={value} /></span>
<span data-k="namespace"><Bundle.default value={value} /></span>
