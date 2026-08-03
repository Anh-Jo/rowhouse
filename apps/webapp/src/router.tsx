import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Placeholder } from "@/components/Placeholder";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { RequireWorkspace } from "@/features/onboarding/components/RequireWorkspace";

const AdminLayout = lazy(() =>
  import("@/layouts/AdminLayout/AdminLayout").then((m) => ({
    default: m.AdminLayout,
  })),
);

const SignInPage = lazy(() =>
  import("@/features/auth/components/SignInPage").then((m) => ({
    default: m.SignInPage,
  })),
);

const SignUpPage = lazy(() =>
  import("@/features/auth/components/SignUpPage").then((m) => ({
    default: m.SignUpPage,
  })),
);

const OnboardingPage = lazy(() =>
  import("@/features/onboarding/components/OnboardingPage").then((m) => ({
    default: m.OnboardingPage,
  })),
);

export const router = createBrowserRouter([
  // Public routes: the only pages reachable without a session.
  {
    path: "/sign-in",
    element: (
      <Suspense fallback={null}>
        <SignInPage />
      </Suspense>
    ),
  },
  {
    path: "/sign-up",
    element: (
      <Suspense fallback={null}>
        <SignUpPage />
      </Suspense>
    ),
  },
  // First-run flow: needs a session but lives outside the app shell.
  {
    path: "/onboarding",
    element: (
      <RequireAuth>
        <Suspense fallback={null}>
          <OnboardingPage />
        </Suspense>
      </RequireAuth>
    ),
  },
  // Authenticated shell: session required, and at least one workspace —
  // otherwise the user is sent to onboarding to create it.
  {
    path: "/",
    element: (
      <RequireAuth>
        <RequireWorkspace>
          <Suspense fallback={null}>
            <AdminLayout />
          </Suspense>
        </RequireWorkspace>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Placeholder name="Home" /> },
      { path: "settings", element: <Placeholder name="Settings" /> },
    ],
  },
]);
