/**
 * Page transition (project UX convention). `template.tsx` re-mounts on every
 * navigation, so the CSS enter (transitions.dev tokens) replays per route.
 * Reduced motion handled by the `.t-enter` guard in transitions.css.
 */
export default function AppTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="t-enter">{children}</div>;
}
