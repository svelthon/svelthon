<script lang="python">
class Box:
    def __init__(self, width, height):
        self.width = width
        self.height = height

    @property
    def area(self):
        return self.width * self.height

    def grow(self, amount):
        self.width += amount
        self.height += amount


box = Box(3, 4)


def bigger():
    box.grow(1)
</script>

<button onclick={bigger}>grow</button>
<p data-k="w">{box.width}</p>
<p data-k="area">{box.area}</p>
