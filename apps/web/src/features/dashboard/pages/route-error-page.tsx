import { isRouteErrorResponse, useRouteError } from "react-router-dom";

import { Button } from "@/components/ui/button";

export function RouteErrorPage() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : "The dashboard hit an unexpected rendering error.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="font-mono text-[11px] text-muted-foreground uppercase tracking-[0.18em]">
          Dashboard error
        </div>
        <h1 className="mt-3 font-medium text-xl">This view could not be opened</h1>
        <p className="mt-3 text-muted-foreground text-sm leading-6">{message}</p>
        <Button className="mt-6" onClick={() => window.location.assign("/dashboard")}>
          Return to pulse
        </Button>
      </section>
    </main>
  );
}
