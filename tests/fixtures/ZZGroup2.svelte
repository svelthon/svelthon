<script module>
    export function peek(o) {
        return JSON.stringify({ js: o.pick });
    }
</script>

<script lang="python">
class Box:
    def __init__(self, pick):
        self.pick = pick


form = {"pick": "a"}
box = Box("a")
report = "—"


def check():
    global report
    report = "dict: python=" + str(form["pick"]) + " " + peek(form) \
        + "  |  objet: python=" + str(box.pick) + " " + peek(box)
</script>

<input data-k="da" type="radio" bind:group={form.pick} value="a" />
<input data-k="db" type="radio" bind:group={form.pick} value="b" />
<input data-k="oa" type="radio" bind:group={box.pick} value="a" />
<input data-k="ob" type="radio" bind:group={box.pick} value="b" />
<button data-k="check" onclick={check}>check</button>

<p data-k="report">{report}</p>
<p data-k="live">dict rendu ici : {form["pick"]}</p>
