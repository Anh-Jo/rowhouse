import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Placeholder } from "@/components/Placeholder";
import { RequireAuth } from "@/features/auth/components/RequireAuth";
import { RequireWorkspace } from "@/features/onboarding/components/RequireWorkspace";
import { FULL_BLEED } from "@/layouts/AdminLayout/route-handle";

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

const HomeRedirect = lazy(() =>
  import("@/features/datasource/components/HomeRedirect").then((m) => ({
    default: m.HomeRedirect,
  })),
);

const DatasourceListPage = lazy(() =>
  import("@/features/datasource/components/DatasourceListPage").then((m) => ({
    default: m.DatasourceListPage,
  })),
);

const ConnectDatasourcePage = lazy(() =>
  import("@/features/datasource/components/ConnectDatasourcePage").then(
    (m) => ({ default: m.ConnectDatasourcePage }),
  ),
);

const DataExplorerPage = lazy(() =>
  import("@/features/explorer/components/DataExplorerPage").then((m) => ({
    default: m.DataExplorerPage,
  })),
);

const SchemaBrowserPage = lazy(() =>
  import("@/features/schema/components/SchemaBrowserPage").then((m) => ({
    default: m.SchemaBrowserPage,
  })),
);

const TableDetailPage = lazy(() =>
  import("@/features/schema/components/TableDetailPage").then((m) => ({
    default: m.TableDetailPage,
  })),
);

const AuditPage = lazy(() =>
  import("@/features/audit/components/AuditPage").then((m) => ({
    default: m.AuditPage,
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
      // Lands on the first project's datasource list (single project in P0).
      { index: true, element: <HomeRedirect /> },
      {
        path: "projects/:projectId/datasources",
        element: <DatasourceListPage />,
      },
      {
        path: "projects/:projectId/datasources/new",
        element: <ConnectDatasourcePage />,
      },
      // Datasource home: the all-tables data view. Full-bleed (route handle):
      // the grid takes the whole viewport width. Two routes for one screen —
      // table list and grid are separate screens on mobile (decision D7).
      {
        path: "projects/:projectId/datasources/:datasourceId/data",
        element: <DataExplorerPage />,
        handle: FULL_BLEED,
      },
      {
        path: "projects/:projectId/datasources/:datasourceId/data/tables/:tableId",
        element: <DataExplorerPage />,
        handle: FULL_BLEED,
      },
      {
        path: "projects/:projectId/datasources/:datasourceId/schema",
        element: <SchemaBrowserPage />,
      },
      // Sibling of the browser (not nested): list + detail are separate
      // screens on mobile (decision D7), each with its own route.
      {
        path: "projects/:projectId/datasources/:datasourceId/schema/tables/:tableId",
        element: <TableDetailPage />,
      },
      { path: "audit", element: <AuditPage /> },
      { path: "settings", element: <Placeholder name="Settings" /> },
    ],
  },
]);
