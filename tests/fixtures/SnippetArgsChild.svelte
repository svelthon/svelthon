<script lang="python">
# Renders the snippet its parent gives it, with a float, None and a callable
# that takes nothing, and a snippet nobody has to give.
children: object = None
footer: object = None

def zero():
    return 7
</script>

{@render children?.(0.25, None, zero)}
{@render footer?.()}
<p data-k="ready">ready</p>
