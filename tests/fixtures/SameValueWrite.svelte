<script lang="python">
kind: str = "state"
tick: object = None
ratio: float = 1.5
level: object = bindable(1.5)
plain = 1.5


@effect
def normalise():
    global plain, ratio, level
    tick()
    if kind == "state":
        plain = round(plain, 2)
    elif kind == "state same":
        plain = plain
    elif kind == "prop":
        ratio = round(ratio, 2)
    elif kind == "bindable":
        level = round(level, 2)


@derived
def doubled():
    global plain
    if kind == "derived write":
        plain = plain
    return int(plain * 2)


@export
def change():
    global plain, ratio, level
    plain = 2.5
    ratio = 2.5
    level = 2.5
</script>

<output>{plain} {ratio} {level} {doubled}</output>
