import { createRouter, useRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }) {
  const router = useRouter();

  return (
    <main className="tara-error-state">
      <div className="tara-error-card">
        <div className="tara-error-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred. Please try again.</p>
        {import.meta.env.DEV && error?.message ? (
          <pre className="tara-error-details">
            {error.message}
          </pre>
        ) : null}
        <div className="tara-error-actions">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="tara-error-retry"
            type="button"
          >
            Try again
          </button>
          <a
            href="/"
            className="tara-error-home"
          >
            Go home
          </a>
        </div>
      </div>
    </main>
  );
}

export const getRouter = () =>
  createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });
