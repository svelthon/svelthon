class Profile:
    pass


class Other:
    pass


_original = Profile


def remove_profile():
    globals().pop("Profile", None)


def restore_profile():
    globals()["Profile"] = _original


def remove_other():
    global Other
    del Other
