import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Placeholder } from "@/components/Placeholder";

const AdminLayout = lazy(() =>
  import("@/layouts/AdminLayout/AdminLayout").then((m) => ({
    default: m.AdminLayout,
  })),
);

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <Suspense fallback={null}>
        <AdminLayout />
      </Suspense>
    ),
    children: [
      { index: true, element: <Placeholder name="Home" /> },
      { path: "settings", element: <Placeholder name="Settings" /> },
    ],
  },
]);
