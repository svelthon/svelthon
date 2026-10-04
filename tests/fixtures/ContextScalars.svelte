<script lang="python">
# A Python provider of scalars: a float subclass, a whole float and a str
# subclass, read by a Python child and a JavaScript one.
from context_scalars import Price, Label
importjs ContextScalarsPython from "./ContextScalarsPython.svelte"
importjs ContextScalarsJs from "./ContextScalarsJs.svelte"

set_context("price", Price(0.5))
set_context("whole", 1.0)
set_context("label", Label("hello"))
</script>

<ContextScalarsPython />
<ContextScalarsJs />
