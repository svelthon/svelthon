<script lang="python">
# Callables shared by context, read by a JavaScript child and by a Python one.
class Doubler:
    def __init__(self):
        self.factor = 2

    def run(self, value):
        return value * self.factor

    def __call__(self, value):
        return value * self.factor


def zero():
    return 7


def formatted(value):
    return format(value, ".2f")


doubler = Doubler()

set_context("zero", zero)
set_context("formatted", formatted)
set_context("bound", doubler.run)
set_context("instance", doubler)
</script>

<ContextCallbacksJs />
<ContextCallbacksPy />

<script module>
import ContextCallbacksJs from './ContextCallbacksJs.svelte';
import ContextCallbacksPy from './ContextCallbacksPy.svelte';
</script>
