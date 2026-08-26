# The same record in both shapes, for a side-by-side measurement.
class Pep:
    def __init__(self, number, title, year):
        self.number = number
        self.title = title
        self.year = year

    @property
    def url(self):
        return "https://peps.python.org/pep-{:04d}/".format(self.number)


def an_object():
    return Pep(703, "Making the GIL Optional", 2023)


def a_dict():
    return {"number": 703, "title": "Making the GIL Optional", "year": 2023}


def describe(value):
    return "{} dict={}".format(type(value).__name__, isinstance(value, dict))
