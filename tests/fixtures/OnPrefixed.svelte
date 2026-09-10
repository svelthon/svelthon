<script lang="python">
importjs OnPrefixedChild from "./OnPrefixedChild.svelte"

# `on` followed by a lowercase letter is what marks a handler, and it catches
# more than handlers: `once`, `only` and `onboarding` are ordinary words. Svelte
# 5 makes any `onfoo` prop a callback by convention, so the breadth is
# defensible; what is not is that such a prop used to skip the boundary where
# Python's None becomes undefined.
missing = None
steps = ["one", "two"]


def clicked():
    pass
</script>

<!-- A real handler, which must still be wrapped and still fire. -->
<button data-k="handler" onclick={clicked}>go</button>

<!-- Caught by the same test and not handlers. A JavaScript child is the consumer
     that sees what actually crossed. -->
<OnPrefixedChild once={missing} only={missing} onboarding={steps} />
