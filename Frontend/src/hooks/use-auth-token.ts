"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useAuthToken() {
  const [loading, setLoading] = useState(false);

  const getToken = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { getToken, loading };
}
