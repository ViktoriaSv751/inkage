import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import "./admin.css";

export const metadata: Metadata = {
  title: "Irányítóközpont · InkAge",
  robots: { index: false, follow: false, nocache: true },
  /* on a phone: "Add to Home Screen" opens the dashboard full screen, with its own name and icon */
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "Irányító", statusBarStyle: "black-translucent" },
};
/* the phone's status bar takes the dashboard's own paper (day) or ink (night); the page runs under the notch */
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F3F0E9" }, { media: "(prefers-color-scheme: dark)", color: "#09090C" }], viewportFit: "cover" };
export const dynamic = "force-dynamic";

/* Inside the store apps (App Store / Google Play review included: their web view says "InkAgeApp") the page does not
   exist. On the web it shows a sign-in that only the e-mail in public.admin_emails gets past; every number comes from
   admin-only database functions. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (/InkAgeApp/.test(headers().get("user-agent") || "")) notFound();
  return (
    <>
      {/* the dashboard's faces: Cormorant Garamond for titles and hero numbers, Geist for everything else */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500..700;1,500..600&family=Geist:wght@400..800&display=swap" />
      {/* the theme before the first paint: the saved choice, otherwise the phone's or computer's own (no dark flash by day) */}
      <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("inkage.admin.theme");var l=t==="light"||(t!=="dark"&&!matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-adm-theme",l?"light":"dark")}catch(e){}` }} />
      {children}
    </>
  );
}
