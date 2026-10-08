# Directives that hand back an instance whose properties raise when Svelte reads
# them, after the directive has returned, and one whose config is fine.
__all__ = ["fading", "moving", "acting", "fine"]


class Broken:
    @property
    def duration(self):
        raise ValueError("duration failed")

    @property
    def update(self):
        raise ValueError("update failed")


class Fine:
    duration = 0.5


def fading(node, params):
    return Broken()


def moving(node, rects):
    return Broken()


def acting(node):
    return Broken()


def fine(node, params):
    return Fine()
