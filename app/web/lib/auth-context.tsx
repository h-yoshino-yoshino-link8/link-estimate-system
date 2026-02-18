"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import { seedOrganizationData } from "./api/seed";

type AuthState = {
  user: User | null;
  orgId: string | null;
  orgName: string | null;
  displayName: string | null;
  loading: boolean;
  isSupabaseMode: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  orgId: null,
  orgName: null,
  displayName: null,
  loading: true,
  isSupabaseMode: false,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const isSupabaseMode = process.env.NEXT_PUBLIC_DATA_SOURCE === "supabase";
  const [user, setUser] = useState<User | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(isSupabaseMode);

  useEffect(() => {
    if (!isSupabaseMode) return;

    const supabase = createClient();

    const fetchProfile = async (userId: string) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id, display_name")
        .eq("id", userId)
        .single();

      if (profile) {
        setOrgId(profile.org_id);
        setDisplayName(profile.display_name);

        const { data: org } = await supabase
          .from("organizations")
          .select("name")
          .eq("id", profile.org_id)
          .single();

        if (org) setOrgName(org.name);

        // 初回ログイン時にシードデータを自動投入
        seedOrganizationData(profile.org_id).catch(() => {});
      }
    };

    supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const newUser = session?.user ?? null;
        setUser(newUser);
        if (newUser) {
          fetchProfile(newUser.id);
        } else {
          setOrgId(null);
          setOrgName(null);
          setDisplayName(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [isSupabaseMode]);

  const signOut = async () => {
    if (!isSupabaseMode) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, orgId, orgName, displayName, loading, isSupabaseMode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
