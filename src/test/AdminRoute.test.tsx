import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useEffect } from "react";

// --- Mocks ---
const eqMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ select: () => ({ eq: eqMock }) }) },
}));

let authState: { user: { id: string } | null; loading: boolean };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));

import { AdminRoute } from "@/components/layout/AdminRoute";

const mountSpy = vi.fn();
function Child() {
  useEffect(() => {
    mountSpy();
  }, []);
  return <p>import page</p>;
}

const tree = () => (
  <MemoryRouter>
    <AdminRoute>
      <Child />
    </AdminRoute>
  </MemoryRouter>
);

describe("AdminRoute", () => {
  beforeEach(() => {
    eqMock.mockReset().mockResolvedValue({ data: [{ role: "admin" }] });
    mountSpy.mockClear();
    authState = { user: { id: "u1" }, loading: false };
  });

  it("finishes the role check once and shows the page to an admin", async () => {
    render(tree());
    expect(await screen.findByText("import page")).toBeInTheDocument();
    expect(eqMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the page mounted when the session re-emits a new object for the same user", async () => {
    const { rerender } = render(tree());
    await screen.findByText("import page");

    // What Supabase does when the window regains focus, e.g. after a file picker closes.
    authState = { user: { id: "u1" }, loading: false };
    rerender(tree());

    await waitFor(() => expect(screen.getByText("import page")).toBeInTheDocument());
    expect(mountSpy).toHaveBeenCalledTimes(1);
    expect(eqMock).toHaveBeenCalledTimes(1);
  });

  it("does not show the page to a user without an allowed role", async () => {
    eqMock.mockResolvedValue({ data: [{ role: "user" }] });
    render(tree());
    await waitFor(() => expect(eqMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("import page")).not.toBeInTheDocument());
  });
});
