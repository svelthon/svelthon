# Another module writing the name, as an attribute of the module it imports.
import live_exports


def write(value):
    live_exports.counter = value
