<script lang="python">
# Props written by what a definition evaluates as it runs, a default, a
# lambda's default, a decorator's argument, in the module's scope; and props
# named as Object's own members, with a default computed and with none.
label: str
other: str
third: str
constructor: str = "Ready" + "!"
toString: str = "Set" + "!"
valueOf: str


def seed(value=(label := "prepared")):
    return value


shout = lambda value=(other := "lambda"): value


def tagged(name):
    return lambda wrapped: wrapped


@tagged(third := "decorated")
def marked():
    return third
</script>

<p>{label}|{seed()}|{other}|{shout()}|{third}|{constructor}|{toString}|{valueOf}</p>
