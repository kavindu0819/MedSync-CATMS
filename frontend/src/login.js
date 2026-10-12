import { api } from "./api";

export async function authenticate(email, password) {
  let response;

  try {
    response = await api.post("/auth/login", {
      email: email.trim().toLowerCase(),
      password,
    });
  } catch (error) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message, { cause: error });
    }
    throw new Error("Unable to reach the server. Please try again.", { cause: error });
  }

  const result = response.data;
  if (
    !result?.success ||
    !["ADMIN", "PATIENT"].includes(result.role) ||
    !result.user
  ) {
    throw new Error("The server returned an invalid sign-in response.");
  }

  return result;
}
