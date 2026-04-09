def register(cc,AuthedUser,router):
    @router.get("/auth/check",tags=['User'])
    def auth_check(
        auth_user: AuthedUser
    ):
        return True