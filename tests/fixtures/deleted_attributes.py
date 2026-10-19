# Instances whose `value` a deletion reaches in each way Python deletes an
# attribute: a property's deleter, a descriptor's `__delete__`, the deleter a
# subclass inherits, one that changes the instance and raises, a property with
# no deleter, an own field through a `__delattr__`, and a class's attribute.
__all__ = ["fresh", "erase", "describe"]


class PropertyBox:
    def __init__(self):
        self.payload = 7
        self.calls = []

    @property
    def value(self):
        return self.payload

    @value.setter
    def value(self, given):
        self.payload = given

    @value.deleter
    def value(self):
        self.calls.append("delete:value")
        self.payload = None


class Deleting:
    def __get__(self, obj, cls=None):
        return obj.payload

    def __set__(self, obj, given):
        obj.payload = given

    def __delete__(self, obj):
        obj.calls.append("delete:value")
        obj.payload = None


class DescriptorBox:
    value = Deleting()

    def __init__(self):
        self.payload = 7
        self.calls = []


class InheritedBox(PropertyBox):
    pass


class RaisingBox(PropertyBox):
    @property
    def value(self):
        return self.payload

    @value.setter
    def value(self, given):
        self.payload = given

    @value.deleter
    def value(self):
        self.calls.append("delete:value")
        self.payload = None
        raise ValueError("cleanup-failed")


class ReadOnlyBox:
    def __init__(self):
        self.payload = 7
        self.calls = []

    @property
    def value(self):
        return self.payload


class OwnBox:
    def __init__(self):
        self.value = 7
        self.calls = []

    def __delattr__(self, name):
        self.calls.append("delete:" + name)
        object.__delattr__(self, name)


class ClassBox:
    value = 7

    def __init__(self):
        self.calls = []


KINDS = {"property": PropertyBox, "descriptor": DescriptorBox, "inherited": InheritedBox, "raising": RaisingBox, "readonly": ReadOnlyBox, "own": OwnBox, "class": ClassBox}


def fresh(kind):
    return KINDS[kind]()


# What `del box.value` answers in Python: "ok", or the exception it raised.
def erase(box):
    try:
        del box.value
        return "ok"
    except Exception as error:
        return type(error).__name__


def describe(box):
    return str([getattr(box, "value", None), box.calls])


if __name__ == "__main__":
    for kind in KINDS:
        box = fresh(kind)
        print(kind, erase(box), describe(box))
