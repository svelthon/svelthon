# Scalars of a class of their own, which a context hands to its readers.
class Price(float):
    currency = "EUR"


class Label(str):
    def shout(self):
        return self.upper() + "!"
