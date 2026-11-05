"use client";
/* the last safety net of the dashboard: an error that got past every card's own boundary leaves a way back, not a blank page */
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="adm gate">
      <div className="lg">
        <div className="lg-h"><span>Irányítóközpont</span></div>
        <p className="lg-msg err" role="alert">Valami nem töltődött be. A számok nem vesztek el.</p>
        <button className="lg-go" onClick={reset} aria-label="Újra"><i>↻</i><span>Újra</span></button>
        <button className="lg-lnk" onClick={() => location.reload()}>Az oldal újratöltése</button>
      </div>
    </div>
  );
}
