import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import "./admin.css";
import "./phone.css";
import "./phone-ma.css";
import "./phone-content.css";
import { AdminGuards } from "./lock";
import "./phone-people.css";
import "./phone-google.css";
import "./quiet.css";
import "./ink.css";
import "./ink-people.css";
import "./ink-content.css";
import "./ink-insight.css";
import "./ink-reach.css";
import "./ink-ops.css";
import "./ink-ma.css";

export const metadata: Metadata = {
  title: { absolute: "Irányítóközpont · InkAge" },
  robots: { index: false, follow: false, nocache: true },
  /* on a phone: "Add to Home Screen" opens the dashboard full screen, with its own name and icon */
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: "Irányító", statusBarStyle: "default" },
};
/* the phone's status bar takes the dashboard's own paper (day) or ink (night); the page runs under the notch */
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#FFFFFF" }, { media: "(prefers-color-scheme: dark)", color: "#000000" }], viewportFit: "cover",
  /* an app, not a page: no zoom on a tap, a double tap or a field (iOS zoomed in and stayed there) */
  width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false };
export const dynamic = "force-dynamic";

/* Inside the store apps (App Store / Google Play review included: their web view says "InkAgeApp") the page does not
   exist. On the web it shows a sign-in that only the e-mail in public.admin_emails gets past; every number comes from
   admin-only database functions. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (/InkAgeApp/.test(headers().get("user-agent") || "")) notFound();
  return (
    <>
      {/* the dashboard's face is Geist; Cormorant stays loaded only for the share images drawn on canvas */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500..700;1,500..600&family=Great+Vibes&family=Geist:wght@400..800&family=Archivo:ital,wdth,wght@0,100,500..900;0,125,500..900;1,125,500..900&display=swap" />
      {/* the theme before the first paint: the saved choice, otherwise the phone's or computer's own (no dark flash by day) */}
      <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("inkage.admin.theme");var l=t==="light"||(t!=="dark"&&!matchMedia("(prefers-color-scheme: dark)").matches);document.querySelectorAll('link[rel="manifest"]').forEach(function(m){m.setAttribute("href","/admin.webmanifest")});document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.removeAttribute("media");m.setAttribute("content",l?"#FFFFFF":"#000000")});document.documentElement.style.colorScheme=l?"light":"dark";document.documentElement.setAttribute("data-adm-theme",l?"light":"dark");var f=localStorage.getItem("inkage.admin.fs");if(f&&f!=="sys")document.documentElement.setAttribute("data-adm-fs",f);var k=JSON.parse(localStorage.getItem("inkage.admin.lock")||"null");if(k&&k.id){var u=Number(localStorage.getItem("inkage.admin.lock_left"))||0;if(localStorage.getItem("inkage.admin.lock_on")==="1"||!u||Date.now()-u>k.after*6e4)document.documentElement.setAttribute("data-adm-locked","1")}}catch(e){}` }} />
      {children}
      <AdminGuards />
    </>
  );
}
