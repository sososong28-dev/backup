const form = document.getElementById("loginForm");
const message = document.getElementById("loginMessage");
const username = document.getElementById("username");
const password = document.getElementById("password");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";
  const button = form.querySelector("button");
  button.disabled = true;

  try {
    const response = await fetch("/api/game/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.value.trim(),
        password: password.value,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "账号或密码不正确。");
    }

    window.location.replace("/game/");
  } catch (error) {
    message.textContent = error.message || "登录失败，请稍后重试。";
  } finally {
    button.disabled = false;
  }
});
