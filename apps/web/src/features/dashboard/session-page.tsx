import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { SessionDetail } from "@/features/session";

import { fetchSessionDetail } from "./api";
import { DashboardError, DashboardPageFrame } from "./dashboard-panels";
import type { SessionDetailResponse } from "./types";
import { useDashboardData } from "./use-dashboard-data";

export function SessionPage() {
  const { architectureShifts } = useDashboardData();
  const { slug } = useParams();
  const [detail, setDetail] = useState<SessionDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(true);

  useEffect(() => {
    if (slug === undefined) {
      setDetail(null);
      setIsDetailLoading(false);
      return;
    }

    let cancelled = false;
    setIsDetailLoading(true);

    fetchSessionDetail(slug)
      .then((response) => {
        if (cancelled) return;
        setDetail(response);
        setError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setDetail(null);
        setError("Unable to load session detail.");
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const relatedShifts = useMemo(() => {
    if (detail === null) return [];
    return architectureShifts.filter((shift) =>
      shift.relatedSessionIds.includes(detail.session.id),
    );
  }, [architectureShifts, detail]);

  return (
    <DashboardPageFrame eyebrow="Session" title={detail?.session.title ?? "Session detail"}>
      <div className="space-y-5">
        {error !== null && <DashboardError message={error} />}
        <SessionDetail detail={detail} isLoading={isDetailLoading} relatedShifts={relatedShifts} />
      </div>
    </DashboardPageFrame>
  );
}
