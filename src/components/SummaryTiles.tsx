interface Props {
  total: number;
  urgent: number;
}

export default function SummaryTiles({ total, urgent }: Props) {
  return (
    <section className="tiles">
      <div className="card tile">
        <div className="tile-label">پیام‌های یکتا</div>
        <div className="tile-value" data-testid="total">
          {total.toLocaleString('en-US')}
        </div>
      </div>
      <div className="card tile urgent">
        <div className="tile-label">فوری (گذشته از مهلت ۲ ساعته)</div>
        <div className="tile-value" data-testid="urgent-count">
          <span data-testid="urgent">{urgent.toLocaleString('en-US')}</span>
        </div>
      </div>
    </section>
  );
}
