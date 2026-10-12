/** Re-mounts on every tab change, so each screen fades in like a native app. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="pagefade">{children}</div>;
}
