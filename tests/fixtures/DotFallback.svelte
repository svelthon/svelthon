<script lang="python">
# The dot in the markup finds a key as well as an attribute, the way Jinja's
# does. In the script it does not, and a function of the script stays script
# wherever it is called from: the rule belongs to the text of the markup.
record = {"title": "Making the GIL Optional", "year": 2023}
nested = {"author": {"name": "Sam Gross"}}
shadowed = {"items": "a key called items"}


class Pep:
    def __init__(self, title):
        self.title = title


obj = Pep("Style Guide for Python Code")


def describe(one):
    # Called from the markup below, and from on_mount.
    try:
        return one.title
    except AttributeError:
        return "AttributeError"


from_mount = describe(record)

clicked = "not clicked"


def note(value):
    global clicked
    clicked = value
</script>

<p data-k="dict">{record.title}</p>
<p data-k="both">{record.title} / {record["title"]}</p>
<p data-k="nested">{nested.author.name}</p>
<p data-k="object">{obj.title}</p>
<p data-k="attribute-wins">{type(shadowed.items).__name__}</p>
<p data-k="key-by-subscript">{shadowed["items"]}</p>
<p data-k="through-call">{describe(record)}</p>
<p data-k="from-mount">{from_mount}</p>
<p data-k="in-lambda">{sorted([record], key=lambda one: one.year)[0].title}</p>

<button data-k="click" onclick={lambda: note(record.title)}>click</button>
<p data-k="clicked">{clicked}</p>
