import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AdminForgotPassword from "./AdminForgotPassword";
import ForgotPassword from "./ForgotPassword";
import VerifyEmail from "./VerifyEmail";

vi.mock("@/lib/api-config", () => ({
  API_BASE_URL: "http://localhost:5000",
  API_ENDPOINTS: {
    AUTH: {
      ADMIN_FORGOT_PASSWORD: "/api/auth/admin-forgot-password",
      FORGOT_PASSWORD: "/api/auth/forgot-password",
      VERIFY_EMAIL: "/api/auth/verify-email",
    },
  },
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("Auth Pages Form Validation", () => {
  it("validates email in AdminForgotPassword", () => {
    render(
      <BrowserRouter>
        <AdminForgotPassword />
      </BrowserRouter>
    );

    const emailInput = screen.getByPlaceholderText(/admin@siu.edu.in/i);
    expect(emailInput).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: "valid.admin@siu.edu.in" } });
    expect(emailInput).toHaveValue("valid.admin@siu.edu.in");
  });

  it("validates email in ForgotPassword", () => {
    render(
      <BrowserRouter>
        <ForgotPassword />
      </BrowserRouter>
    );

    const emailInput = screen.getByPlaceholderText(/your.email@sitpune.edu.in/i);
    expect(emailInput).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: "student.123@sitpune.edu.in" } });
    expect(emailInput).toHaveValue("student.123@sitpune.edu.in");
  });

  it("renders VerifyEmail component properly", () => {
    render(
      <BrowserRouter>
        <VerifyEmail />
      </BrowserRouter>
    );

    expect(screen.getByText(/Verify Your Email/i)).toBeInTheDocument();
  });
});
