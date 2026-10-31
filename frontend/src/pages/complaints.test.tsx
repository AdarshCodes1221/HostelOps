import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Complaints from "./Complaints";

vi.mock("@/lib/api-config", () => ({
  API_BASE_URL: "http://localhost:5000",
  API_ENDPOINTS: {
    COMPLAINTS_MY: "/api/complaints/my",
    ADMIN_COMPLAINTS: "/api/admin/complaints",
  },
  authenticatedFetch: vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, data: [] }),
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      _id: "student123",
      firstName: "Test",
      lastName: "Student",
      role: "student",
      hostel: "Symbiosis Royal Hostel",
      floor: "1",
      roomNumber: "101",
    },
    isAdmin: false,
    isAuthenticated: true,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

describe("Complaints Page Component", () => {
  it("renders Complaints page without TDZ or initialization crash", async () => {
    render(
      <BrowserRouter>
        <Complaints />
      </BrowserRouter>
    );

    // Verify title and submit complaint card renders without TDZ error
    expect(screen.getByText(/Complaint Management/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Submit Complaint/i).length).toBeGreaterThan(0);
  });
});
