"use client";

import { AppShell } from "@/components/portal/AppShell";
import { IntroProvider } from "@/components/portal/Intro";
import { SessionProvider } from "@/lib/session";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IntroProvider>
        <AppShell>{children}</AppShell>
      </IntroProvider>
    </SessionProvider>
  );
}
