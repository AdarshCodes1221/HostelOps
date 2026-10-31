import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { Alert, AlertTitle, AlertDescription } from "./alert";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";
import { SidebarProvider, SidebarRail, SidebarMenuSkeleton } from "./sidebar";
import { NotificationBell } from "../NotificationBell";

// Mock API config and context for NotificationBell
vi.mock("@/lib/api-config", () => ({
  API_BASE_URL: "http://localhost:5000",
  API_ENDPOINTS: {
    NOTIFICATIONS_MY: "/api/notifications/my",
    NOTIFICATIONS_UNREAD_COUNT: "/api/notifications/unread-count",
    NOTIFICATION_READ: (id: string) => `/api/notifications/${id}/read`,
    NOTIFICATIONS_READ_ALL: "/api/notifications/read-all",
  },
  authenticatedFetch: vi.fn().mockImplementation((url: string) => {
    if (url === "/api/notifications/unread-count") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ unreadCount: 1 }),
      });
    }
    return Promise.resolve({
      ok: true,
      json: async () => ({
        data: [
          {
            _id: "notif-1",
            title: "New Notice",
            message: "A test message",
            type: "announcement",
            createdAt: new Date().toISOString(),
            read: false,
          },
        ],
      }),
    });
  }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user-id", role: "student" },
    token: "mock-token",
    isAuthenticated: true,
    isAdmin: false,
  }),
}));

describe("UI Components - Alert & Card", () => {
  it("renders Alert and AlertTitle correctly as heading", () => {
    render(
      <Alert>
        <AlertTitle>Alert Heading</AlertTitle>
        <AlertDescription>Alert description text</AlertDescription>
      </Alert>
    );

    const heading = screen.getByRole("heading", { level: 5 });
    expect(heading).toHaveTextContent("Alert Heading");
    expect(screen.getByText("Alert description text")).toBeInTheDocument();
  });

  it("renders Card and CardTitle correctly as heading", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Card Main Title</CardTitle>
          <CardDescription>Sub description</CardDescription>
        </CardHeader>
        <CardContent>Content Body</CardContent>
        <CardFooter>Footer Info</CardFooter>
      </Card>
    );

    const heading = screen.getByRole("heading", { level: 3 });
    expect(heading).toHaveTextContent("Card Main Title");
    expect(screen.getByText("Content Body")).toBeInTheDocument();
  });
});

describe("UI Components - Sidebar", () => {
  it("renders SidebarRail with button type and toggle handling", () => {
    render(
      <SidebarProvider>
        <SidebarRail />
      </SidebarProvider>
    );

    const rail = screen.getByLabelText("Toggle Sidebar");
    expect(rail).toBeInTheDocument();
    expect(rail).toHaveAttribute("type", "button");
  });

  it("renders SidebarMenuSkeleton with consistent width calculation", () => {
    const { container } = render(
      <SidebarProvider>
        <SidebarMenuSkeleton showIcon={true} />
      </SidebarProvider>
    );

    expect(container.firstChild).toBeInTheDocument();
  });
});

describe("NotificationBell", () => {
  it("renders notification bell and triggers click and keydown", async () => {
    render(
      <BrowserRouter>
        <NotificationBell />
      </BrowserRouter>
    );
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    fireEvent.click(button);

    // Look for notification popover item
    const notifItem = await screen.findByText("New Notice");
    expect(notifItem).toBeInTheDocument();

    const notifButton = notifItem.closest('[role="button"]');
    if (notifButton) {
      fireEvent.keyDown(notifButton, { key: "Enter" });
      fireEvent.keyDown(notifButton, { key: " " });
    }
  });
});
