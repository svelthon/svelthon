<script lang="python">
# Callbacks handed to functions reached through an imported namespace or
# default export, in every shape a callback comes in, and what such a member
# keeps: its receiver, its identity, its live binding, a class among them.
importjs * as Tools from './import_members.js'
importjs Lib from './import_members.js'
importjs { Watcher, register } from './import_members.js'


def done():
    return 42


class Holder:
    def run(self):
        return 42


class Callable:
    def __call__(self):
        return 42


holder = Holder()
shapes = {"function": done, "bound": holder.run, "instance": Callable()}


@export
def through_namespace(kind):
    return Tools.invoke(shapes[kind])


@export
def through_default(kind):
    return Lib.invoke(shapes[kind])


@export
def receiver():
    return Tools.helpers.label("x")


@export
def nested():
    return Lib.helpers.nested.twice(lambda value: value * 10)


@export
def same():
    return Tools.invoke is Tools.invoke


@export
def live():
    before = Tools.current()
    Tools.swap()
    return [before, Tools.current()]


@export
def constructed():
    counter = Tools.Counter.new()
    return counter.add(done)


@export
def constructor_callback(kind):
    return [Watcher.new(shapes[kind]).answer, Tools.Watcher.new(shapes[kind]).answer]


@export
async def resolved(kind):
    box = await Tools.later()
    return box.invoke(shapes[kind])


@export
def read_once():
    return Tools.queue().next


@export
def other_positions(kind):
    box = Tools.target()
    box.handler = shapes[kind]
    return [box.fire(), Tools.handlers[0](shapes[kind]), Tools.withOptions({"cb": shapes[kind]})]


@export
def one_identity():
    # The same callback through a direct import and through a member: one
    # function to the registry, so it is counted once.
    register(done)
    return Lib.register(done)
</script>
