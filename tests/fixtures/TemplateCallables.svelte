<script lang="python">
# Every shape of Python callable, reached at the root of a template expression:
# a prop to a JavaScript child, a handler, an attachment, and what an attachment
# hands back as its cleanup.
importjs CallbackChild from "./CallbackChild.svelte"


def run(value):
    return round(value * value, 2)


class Holder:
    def run(self, value):
        return round(value * value, 2)

    @classmethod
    def made(cls, value):
        return round(value * value, 2)

    @staticmethod
    def fixed(value):
        return round(value * value, 2)


class Squarer:
    def __call__(self, value):
        return round(value * value, 2)


holder = Holder()
heads = {
    "function": run,
    "bound": holder.run,
    "classmethod": Holder.made,
    "staticmethod": Holder.fixed,
    "instance": Squarer(),
}
kind: str = "function"
hits = []


def hit(event=None):
    hits.append(1)


class Clicker:
    def click(self, event=None):
        hits.append(1)

    @classmethod
    def tap(cls, event=None):
        hits.append(1)


clicker = Clicker()


class Cleaner:
    def __init__(self, node):
        self.node = node

    def close(self):
        self.node.setAttribute("data-cleaned", "yes")

    def __call__(self):
        self.close()


def install_method(node):
    node.setAttribute("data-installed", "yes")
    return Cleaner(node).close


def install_instance(node):
    node.setAttribute("data-installed", "yes")
    return Cleaner(node)


@export
def hit_count():
    return len(hits)
</script>

<CallbackChild cb={heads[kind]} config={{"cb": heads[kind]}} />

<button data-k="bound-handler" onclick={clicker.click}>hit</button>
<button data-k="classmethod-handler" onclick={Clicker.tap}>tap</button>
<p data-k="attach-bound" {@attach install_method}>x</p>
<p data-k="attach-instance" {@attach install_instance}>x</p>
