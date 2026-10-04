<script lang="python">
# `class:name` and `style:name` written short, beside their long spelling.
active = None
empty = []
on = "yes"
color = None
size = "2em"


def toggle():
    global active, color
    active = True
    color = "red"
</script>

<p data-k="none-short" class:active>a</p>
<p data-k="none-long" class:active={active}>a</p>
<p data-k="empty-short" class:empty>b</p>
<p data-k="empty-long" class:empty={empty}>b</p>
<p data-k="on-short" class:on>c</p>
<p data-k="on-long" class:on={on}>c</p>
<p data-k="color-short" style:color>d</p>
<p data-k="color-long" style:color={color}>d</p>
<p data-k="size-short" style:font-size={size} style:size>e</p>
<p data-k="size-long" style:font-size={size} style:size={size}>e</p>
<button onclick={toggle}>toggle</button>
