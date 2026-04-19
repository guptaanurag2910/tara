import * as React from "react";
import {
  Link as TanStackLink,
  Navigate as TanStackNavigate,
  useLocation as useTanStackLocation,
  useNavigate as useTanStackNavigate,
  useParams as useTanStackParams,
} from "@tanstack/react-router";

export function Link({ to, ...props }) {
  return <TanStackLink to={to} {...props} />;
}

export function Navigate({ to, replace = false, state }) {
  return <TanStackNavigate to={to} replace={replace} state={state} />;
}

export function useNavigate() {
  const navigate = useTanStackNavigate();

  return React.useCallback(
    (to, options = {}) => {
      if (typeof to === "number") {
        window.history.go(to);
        return;
      }

      if (typeof to === "string") {
        return navigate({
          to,
          replace: Boolean(options?.replace),
          state: options?.state,
        });
      }

      if (to && typeof to === "object" && "pathname" in to) {
        return navigate({
          to: to.pathname,
          search: to.search,
          hash: to.hash,
          replace: Boolean(options?.replace),
          state: options?.state,
        });
      }

      return navigate(to);
    },
    [navigate],
  );
}

export function useLocation() {
  return useTanStackLocation();
}

export function useParams() {
  return useTanStackParams({ strict: false });
}

