class Profile:
    pass


class Other:
    pass


_original = Profile


def remove_profile():
    global Profile
    del Profile


def restore_profile():
    global Profile
    Profile = _original


def remove_other():
    global Other
    del Other
