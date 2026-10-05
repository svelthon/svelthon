# Another module writing a name `js_import_private` brings from JavaScript.
import js_import_private


def write():
    js_import_private.counter = 9


def write_attribute():
    setattr(js_import_private, "counter", 10)
