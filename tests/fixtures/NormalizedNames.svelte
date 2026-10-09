<script lang="python">
# Identifiers as Python reads them, normalized to NFKC: a ligature and an accent
# written in two code points name what their plain spelling names, in the markup
# as in the script.
class Box:
    def __init__(self):
        self.field = "field"
        self.café = "composed"


box = Box()
</script>

<p data-k="ligature">{box.ﬁeld}</p>
<p data-k="decomposed">{box.café}</p>
<p data-k="lambda">{(lambda one: one.ﬁeld)(box)}</p>
