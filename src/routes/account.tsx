import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/components/baruna/auth/RequireAuth";

export const Route = createFileRoute("/account")({
  component: AccountShell,
});

function AccountShell() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}
