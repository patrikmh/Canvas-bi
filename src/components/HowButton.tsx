export function HowButton({ id, onClick }: { id: string; onClick: () => void }) {
  return <button className="how-button" data-testid={`how-${id}`} onClick={onClick}>Hur räknas detta? <span aria-hidden="true">›</span></button>
}
