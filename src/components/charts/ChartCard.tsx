import { useState, type ReactNode } from 'react'
import { Icon } from '../Icon'

export interface LegendItem {
  label: string
  color: string
}

interface Props {
  title: string
  subtitle?: ReactNode
  /** Shown for two or more series; a single series is named by the title. */
  legend?: LegendItem[]
  table: { columns: string[]; rows: (string | number)[][] }
  children: ReactNode
}

/** Chart frame with a legend and a table view of the same numbers. */
export function ChartCard({ title, subtitle, legend, table, children }: Props) {
  const [showTable, setShowTable] = useState(false)
  return (
    <section className="card chart-card" aria-label={title}>
      <header className="chart-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted small">{subtitle}</p>}
        </div>
        <button
          className={showTable ? 'icon-btn active' : 'icon-btn'}
          onClick={() => setShowTable(!showTable)}
          aria-pressed={showTable}
          aria-label={showTable ? 'Show chart' : 'Show table'}
          title={showTable ? 'Show chart' : 'Show table'}
        >
          <Icon name={showTable ? 'chart' : 'table'} />
        </button>
      </header>
      {legend && legend.length > 1 && !showTable && (
        <ul className="legend">
          {legend.map((item) => (
            <li key={item.label}>
              <span className="swatch" style={{ background: item.color }} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
      )}
      {showTable ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (j === 0 ? <th key={j} scope="row">{cell}</th> : <td key={j}>{cell}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  )
}
