<script lang="python">
# Callbacks handed to functions reached through an imported namespace or
# default export, in every shape a callback comes in, and what such a member
# keeps: its receiver, its identity, its live binding, a class among them.
importjs * as Tools from './import_members.js'
importjs Lib from './import_members.js'


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
</script>
