<script lang="python">
# An action and a transition a parent hands in as props, which are JavaScript
# functions: they are given the values Python holds as JavaScript's.
act: object = None
fade: object = None
shape: str = "scalar"

class Runner:
    def __init__(self, answer):
        self.answer = answer

    def run(self):
        return self.answer

def make(step):
    if shape == "scalar":
        return 0.25 * step
    if shape == "record":
        return {"weight": 0.25 * step}
    return {"run": Runner(0.25 * step).run}

value = make(1)
shown = False

@export
def change():
    global value
    value = make(2)

@export
def show():
    global shown
    shown = True
</script>

<p use:act={value}>action</p>
{#if shown}<i in:fade={0.25}>shown</i>{/if}
