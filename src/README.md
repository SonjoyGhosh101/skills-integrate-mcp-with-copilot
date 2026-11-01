# Mergington High School Activities API

A super simple FastAPI application that allows students to view and sign up for extracurricular activities.

## Features

- View all available extracurricular activities
- Teacher-only student registration and unregistration
- Public activity and participant list
- Hashed teacher passwords and expiring signed sessions

## Getting Started

1. Install the dependencies:

   ```
   pip install fastapi uvicorn
   ```

2. Create `teachers.json` in this directory to configure a teacher account. Generate a password hash with:

```sh
python -c 'import getpass,json; from app import hash_password; print(json.dumps({"teachers":[{"username":"teacher","password_hash":hash_password(getpass.getpass("Teacher password: "))}]}, indent=2))' > teachers.json
```

This creates one teacher account named `teacher`; edit the username in the generated file if needed. The password itself is not written to the file. `teachers.json` is ignored by Git. Never commit this file. For deployment, set `SESSION_SECRET` to a stable, random secret and set `SESSION_COOKIE_SECURE=true` when serving over HTTPS.

3. Run the application:

   ```
   python app.py
   ```

4. Open your browser and go to:
   - API documentation: http://localhost:8000/docs
   - Alternative documentation: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint                                                          | Description                                                         |
| ------ | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| GET    | `/activities`                                                     | Get all activities with their details and current participant count |
| GET    | `/auth/session`                                                    | Check whether the current browser has a teacher session              |
| POST   | `/auth/login`                                                      | Sign in with a teacher username and password                         |
| POST   | `/auth/logout`                                                     | Sign out and clear the teacher session                               |
| POST   | `/activities/{activity_name}/signup?email=student@mergington.edu` | Register a student (teacher session required)                       |
| DELETE | `/activities/{activity_name}/unregister?email=student@mergington.edu` | Unregister a student (teacher session required)                   |

## Data Model

The application uses a simple data model with meaningful identifiers:

1. **Activities** - Uses activity name as identifier:

   - Description
   - Schedule
   - Maximum number of participants allowed
   - List of student emails who are signed up

2. **Students** - Uses email as identifier:
   - Name
   - Grade level

Activity and participant data is stored in memory, which means it will be reset when the server restarts. Teacher credentials are stored separately in `teachers.json` as salted PBKDF2 hashes.
