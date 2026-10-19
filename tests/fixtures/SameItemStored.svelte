<script lang="python">
class Stored:
    def __init__(self):
        object.__setattr__(self, "_kept", js.Object.new())
        self.x = 1.5

    def __setattr__(self, name, value):
        js.Reflect.set(object.__getattribute__(self, "_kept"), name, value)

    def shown(self):
        return object.__getattribute__(self, "_kept").x


stored = Stored()


@export
def change():
    stored.x = 2.5
</script>

<output>{stored.shown()}</output>
