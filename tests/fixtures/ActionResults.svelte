<script lang="python">
# An action written in Python answers in each shape Svelte reads `update` and
# `destroy` off: a dict, an instance, a function carrying both, and an instance
# that is callable itself.
shape: str = "dict"
log = []
value = 1


def record(what):
    log.append(what)


class Lease:
    def update(self, given):
        record(f"update:{given}")

    def destroy(self):
        record(f"destroy:{value}")


class CallableLease(Lease):
    def __call__(self):
        pass


def action(node, given):
    record(f"install:{given}")

    if shape == "dict":
        return {"update": lambda next_value: record(f"update:{next_value}"), "destroy": lambda: record(f"destroy:{value}")}
    if shape == "instance":
        return Lease()
    if shape == "callable instance":
        return CallableLease()

    def lease():
        pass

    lease.update = lambda next_value: record(f"update:{next_value}")
    lease.destroy = lambda: record(f"destroy:{value}")
    return lease


@export
def change():
    global value
    value = 2


@export
def model():
    return ",".join(log)
</script>

<p use:action={value}>action</p>
