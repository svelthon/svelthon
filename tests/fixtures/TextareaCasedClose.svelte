<script lang="python">
# Textareas closed in another case, which Svelte reads as their own closing
# tags, each followed by a control whose attribute is a Python expression.
flag = False

@export
def toggle():
    global flag
    flag = not flag
</script>

<textarea>one</TEXTAREA>
<button disabled={flag}>press</button>
<textarea>two</TextArea >
<input type="checkbox" checked={flag} />
