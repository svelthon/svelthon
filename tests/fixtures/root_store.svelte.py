"""An effect in a shared module, which has no component to belong to.

`$effect.root` is what makes that possible: it opens a scope of its own, and
hands back the destructor — which the decorated name receives.
"""

count = 0
runs = []


@effect.root
def destroy():
    js.String(count)
    js.document.body.setAttribute(
        "data-store", (js.document.body.getAttribute("data-store") or "") + "s"
    )


def bump():
    global count
    count += 1
