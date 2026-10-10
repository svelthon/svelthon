<script lang="python">
# The three things JavaScript's `=` writes and Python's `:=` would not: a name,
# an attribute, a key. The dotted button aims at a *dict*, which is the form
# that needs the rule the read already follows.
class Box:
    def __init__(self):
        self.width = 1
        self.field = 0


m = {"x": 0, "y": 0, "field": 0}
box = Box()
tally = 0
chosen = 0
rows = [0, 0]
boxes = [Box(), Box()]
</script>

<p data-k="key">{m["x"]}</p>
<p data-k="dot">{m["y"]}</p>
<p data-k="attr">{box.width}</p>
<p data-k="tally">{tally}</p>

<button data-k="by-key" onclick={lambda: (m["x"] := 5)}>key</button>
<button data-k="by-dot" onclick={lambda: (m.y := 6)}>dot</button>
<button data-k="by-attr" onclick={lambda: (box.width := 7)}>attribute</button>
<button data-k="by-event" onclick={lambda event: (m["x"] := event.detail)}>from the event</button>
<button data-k="mixed" onclick={lambda: (tally := tally + 1, m["x"] := 9, box.width := 9)}>all three</button>

<!-- An attribute written with a ligature is the one read without, and a walrus
     inside a target's key or receiver writes the component's name. -->
<p data-k="field">{box.field}|{m["field"]}</p>
<p data-k="nested">{chosen}|{rows[1]}|{boxes[1].width}</p>
<button data-k="by-ligature" onclick={lambda: (box.ﬁeld := 3, m.ﬁeld := 4)}>ligature</button>
<button data-k="nested-key" onclick={lambda: (rows[(chosen := 1)] := 7)}>key</button>
<button data-k="nested-receiver" onclick={lambda: (boxes[(chosen := 1)].width := 8)}>receiver</button>
