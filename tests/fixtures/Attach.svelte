<script lang="python">
label = "one"
seen = []


def stamp(element):
    element.setAttribute("data-stamped", label)

    def clean():
        js.document.body.setAttribute("data-cleaned", "yes")

    return clean


def tooltip(text):
    def attach(element):
        element.setAttribute("data-tip", text.upper())

    return attach


def rename():
    global label
    label = "two"
</script>

<p data-k="target" {@attach stamp}>target</p>
<p data-k="tipped" {@attach tooltip(label)}>hover</p>
<button onclick={rename}>rename</button>
