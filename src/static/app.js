document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupContainer = document.getElementById("signup-container");
  const messageDiv = document.getElementById("message");
  const teacherLoginForm = document.getElementById("teacher-login-form");
  const teacherLogoutButton = document.getElementById("teacher-logout");
  const teacherSession = document.getElementById("teacher-session");
  let isTeacher = false;
  let messageTimeout;

  function showMessage(message, type) {
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => messageDiv.classList.add("hidden"), 5000);
  }

  async function refreshTeacherSession() {
    try {
      const response = await fetch("/auth/session");
      const session = await response.json();
      isTeacher = response.ok && session.authenticated === true;
      teacherLoginForm.classList.toggle("hidden", isTeacher);
      teacherLogoutButton.classList.toggle("hidden", !isTeacher);
      signupContainer.classList.toggle("hidden", !isTeacher);
      teacherSession.textContent = isTeacher
        ? `Signed in as ${session.username}`
        : "";
      teacherSession.classList.toggle("hidden", !isTeacher);
    } catch (error) {
      isTeacher = false;
      teacherLoginForm.classList.remove("hidden");
      teacherLogoutButton.classList.add("hidden");
      signupContainer.classList.add("hidden");
      teacherSession.classList.add("hidden");
    }
  }

  teacherLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("teacher-username").value;
    const password = document.getElementById("teacher-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Sign-in failed");

      teacherLoginForm.reset();
      await refreshTeacherSession();
      await fetchActivities();
      showMessage("Teacher signed in.", "success");
    } catch (error) {
      showMessage(error.message || "Unable to sign in.", "error");
    }
  });

  teacherLogoutButton.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", { method: "POST" });
      await refreshTeacherSession();
      await fetchActivities();
      showMessage("Signed out. Activities remain available to view.", "success");
    } catch (error) {
      showMessage("Unable to sign out. Please try again.", "error");
    }
  });

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      if (!response.ok) throw new Error("Activity request failed");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${isTeacher ? `<button class="delete-btn" data-activity="${name}" data-email="${email}" aria-label="Unregister ${email}">Remove</button>` : ""}</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  refreshTeacherSession().then(fetchActivities);
});
