import json
import tempfile
import unittest
from http.cookies import SimpleCookie
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException, Response
from fastapi.routing import APIRoute
from starlette.requests import Request

import app as app_module


def make_request(cookie_value=None):
    headers = []
    if cookie_value:
        headers.append((b"cookie", f"{app_module.SESSION_COOKIE_NAME}={cookie_value}".encode()))
    return Request({
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": headers,
        "client": ("testclient", 123),
        "server": ("testserver", 80),
    })


class AdminModeTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.credentials_path = Path(self.temp_dir.name) / "teachers.json"
        self.credentials_path.write_text(json.dumps({
            "teachers": [{
                "username": "teacher",
                "password_hash": app_module.hash_password("correct horse"),
            }]
        }), encoding="utf-8")
        credentials_patch = patch.object(
            app_module, "TEACHER_CREDENTIALS_PATH", self.credentials_path
        )
        credentials_patch.start()
        self.addCleanup(credentials_patch.stop)

    def test_password_hash_verifies_only_matching_password(self):
        stored_hash = app_module.hash_password("correct horse")

        self.assertTrue(app_module.verify_password("correct horse", stored_hash))
        self.assertFalse(app_module.verify_password("wrong password", stored_hash))

    def test_anonymous_request_is_not_a_teacher(self):
        with self.assertRaises(HTTPException) as error:
            app_module.require_teacher(make_request())

        self.assertEqual(error.exception.status_code, 401)

    def test_valid_teacher_session_is_accepted(self):
        token = app_module.create_teacher_session("teacher")

        self.assertEqual(app_module.require_teacher(make_request(token)), "teacher")

    def test_login_sets_http_only_cookie_for_valid_credentials(self):
        response = Response()

        result = app_module.login(
            app_module.TeacherLogin(username="teacher", password="correct horse"),
            response,
        )
        cookie = SimpleCookie()
        cookie.load(response.headers["set-cookie"])

        self.assertTrue(result["authenticated"])
        self.assertTrue(cookie[app_module.SESSION_COOKIE_NAME]["httponly"])
        self.assertEqual(
            app_module.get_teacher_session(
                make_request(cookie[app_module.SESSION_COOKIE_NAME].value)
            ),
            "teacher",
        )

    def test_login_rejects_invalid_password(self):
        with self.assertRaises(HTTPException) as error:
            app_module.login(
                app_module.TeacherLogin(username="teacher", password="wrong password"),
                Response(),
            )

        self.assertEqual(error.exception.status_code, 401)

    def test_only_mutation_routes_require_teacher(self):
        routes = {
            (route.path, method): route
            for route in app_module.app.routes
            if isinstance(route, APIRoute)
            for method in route.methods
        }

        signup_route = routes[("/activities/{activity_name}/signup", "POST")]
        unregister_route = routes[("/activities/{activity_name}/unregister", "DELETE")]
        activities_route = routes[("/activities", "GET")]

        self.assertIn(
            app_module.require_teacher,
            [dependency.call for dependency in signup_route.dependant.dependencies],
        )
        self.assertIn(
            app_module.require_teacher,
            [dependency.call for dependency in unregister_route.dependant.dependencies],
        )
        self.assertNotIn(
            app_module.require_teacher,
            [dependency.call for dependency in activities_route.dependant.dependencies],
        )


if __name__ == "__main__":
    unittest.main()