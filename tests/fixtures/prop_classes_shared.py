# An int subclass both PropClassesHost and PropClassesChild import.
class Shared(int):
    def __new__(cls, value, tag):
        self = super().__new__(cls, value)
        self.tag = tag
        return self
