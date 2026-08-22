<script lang="python">
# The dot in the markup finds a key as well as an attribute, the way Jinja's
# does. In the script, right here, it does not — `record.title` below would
# raise, and `describe()` proves where the seam actually falls.
record = {"title": "Making the GIL Optional", "year": 2023}
nested = {"author": {"name": "Sam Gross"}}
shadowed = {"items": "a key called items"}


class Pep:
    def __init__(self, title):
        self.title = title


obj = Pep("Style Guide for Python Code")


def describe(one):
    # Called from the markup below, and from on_mount at the same time.
    return one.title


from_mount = "not run"


def on_mount():
    global from_mount
    try:
        from_mount = describe(record)
    except AttributeError:
        from_mount = "AttributeError"
</script>

<p data-k="dict">{record.title}</p>
<p data-k="both">{record.title} / {record["title"]}</p>
<p data-k="nested">{nested.author.name}</p>
<p data-k="object">{obj.title}</p>
<p data-k="attribute-wins">{type(shadowed.items).__name__}</p>
<p data-k="key-by-subscript">{shadowed["items"]}</p>
<p data-k="through-call">{describe(record)}</p>
<p data-k="from-mount">{from_mount}</p>
