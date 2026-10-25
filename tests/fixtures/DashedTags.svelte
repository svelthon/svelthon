<script lang="python">
# Tags a capital starts that hold a dash, elements to Svelte: no name of the
# script, and no component.
title = "before"


@export
def retitle():
    global title
    title = "after"
</script>

<Dashed-tag data-k="first" title={title}>ok</Dashed-tag>
<Dashed-Tag data-k="parts" title={title}>ok</Dashed-Tag>
<DASHED-TAG data-k="upper" title={title}>ok</DASHED-TAG>
<Dashed-Long-Tag data-k="long" title={title}>ok</Dashed-Long-Tag>
