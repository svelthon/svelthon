<script module lang="ts">
    // Three spellings of a type imported from a JavaScript child, none of which
    // binds a name at run time.
    import type ByDefault from './TypedChildJs.svelte';
    import type { default as ByName } from './TypedChildJs.svelte';
    import { type default as Inline } from './TypedChildJs.svelte';
</script>

<script lang="python">
# The instance is handed the components under those names, a Python one, and
# its props cross as that child's.
ByDefault: object
ByName: object
Inline: object
kind: str = "whole"
class Price(float):
    pass
amount = 1.0 if kind == "whole" else Price(0.5)
</script>

<ByDefault {amount} />
<ByName {amount} />
<Inline {amount} />
