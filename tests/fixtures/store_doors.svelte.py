"""The two doors a JavaScript value has into a store, on one module.

A published name can be *assigned* (`store.held = 0.25`) or handed to a
*function* (`store.take(0.25)`), and both are crossings. The table in bridge.js
names seven and the setter was an eighth, unlisted and untreated: the value
landed as raw JavaScript, so `type(held)` answered `JSObject` and
`format(held, ".2f")` raised while the call beside it worked.
"""

held = None


def describe():
    # What Python holds, and whether it can be used as the type it claims.
    try:
        usable = format(held, ".2f")
    except Exception as error:
        usable = "raises " + type(error).__name__

    return type(held).__name__ + " | " + usable


def take(value):
    # The other door, whose argument crosses at a boundary that converts.
    global held
    held = value

    return describe()
