import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Auth from "../features/Auth";
const login = vi.hoisted(() => vi.fn());
vi.mock("../app/context", () => ({
  useAuth: () => ({ login, register: vi.fn() }),
  useConfig: () => ({ data: { demoMode: false } }),
}));
describe("authentication form", () => {
  it("validates inputs before sending credentials", async () => {
    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email")).toBeVisible();
    expect(login).not.toHaveBeenCalled();
  });
  it("shows a backend error without clearing recoverable input", async () => {
    login.mockRejectedValue(new Error("Email or password is incorrect"));
    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "A-password-2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password is incorrect",
    );
    expect(screen.getByLabelText("Email address")).toHaveValue(
      "test@example.com",
    );
  });
});
