<script lang="python">
# Tags written in Python strings, in an attribute's value, in comments and in a
# textarea: text, every one of them, and none of them opens a block of the
# component.
name = "Ada"
</script>

<p data-k="f-string style">{f"<style>{name}</style>"}</p>
<p data-k="f-string script">{f"<script>{name}</script>"}</p>
<p data-k="language">{"<script lang=python>" + name + "</script>"}</p>
<input data-k="attribute" title="> <style>{name.upper()}</style>" />
<!-- <style> --><p data-k="comment">{name.upper()}</p><!-- </style> -->
<textarea data-k="textarea"><style>{name.upper()}</style></textarea>
