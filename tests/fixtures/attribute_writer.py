# Another module writing attributes on `attribute_target`: a name its text
# binds is written, and one it does not is refused, as a deletion is.
import attribute_target


def tried(write):
    try:
        write()
        return "written"
    except AttributeError as error:
        return "refused: " + str(error)


def writes():
    return [
        tried(lambda: setattr(attribute_target, "x", 5)),
        attribute_target.read(),
        tried(lambda: setattr(attribute_target, "rea" + "dy", False)),
        tried(lambda: setattr(attribute_target, "phantom", 3)),
        tried(lambda: delattr(attribute_target, "x")),
        hasattr(attribute_target, "phantom"),
    ]
