# Properties that count their reads or raise, and attributes a `__getattr__`
# makes, asked for with `in` from JavaScript.
__all__ = ["config", "dynamic", "reads"]

count = 0


class Config:
    def __init__(self):
        self.field = 1

    @property
    def counted(self):
        global count
        count += 1
        return 42

    @property
    def raising(self):
        global count
        count += 1
        raise ValueError("property read")


class Dynamic:
    def __getattr__(self, name):
        if name == "made":
            return 7
        raise AttributeError(name)


config = Config()
dynamic = Dynamic()


def reads():
    return count
