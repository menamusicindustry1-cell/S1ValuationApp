import { useMemo, useState } from "react";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const seedData = [
  {
    id: 1,
    company: "Reddit",
    sic: "7372",
    filingDate: "2024-02-22",
    location: "San Francisco, CA",
    revenue: 804000000,
    ebitda: -69000000,
    evRevenue: 5.6,
    evEbitda: null,
    include: true,
  },
  {
    id: 2,
    company: "Instacart",
    sic: "7389",
    filingDate: "2023-08-25",
    location: "San Francisco, CA",
    revenue: 2551000000,
    ebitda: 428000000,
    evRevenue: 3.65,
    evEbitda: 21.7,
    include: true,
  },
  {
    id: 3,
    company: "Klaviyo",
    sic: "7372",
    filingDate: "2023-08-25",
    location: "Boston, MA",
    revenue: 472000000,
    ebitda: -35000000,
    evRevenue: 16.1,
    evEbitda: null,
    include: true,
  },
];

function money(value) {
  if (value === null || value === undefined) return "N/M";

  if (Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`;
  }

  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }

  return `$${value}`;
}

function multiple(value) {
  if (value === null || value === undefined) {
    return "N/M";
  }

  return `${value.toFixed(2)}x`;
}

function average(values) {
  const valid = values.filter((v) => v !== null);

  if (!valid.length) return null;

  return (
    valid.reduce((a, b) => a + b, 0) /
    valid.length
  );
}

export default function App() {
  const [rows, setRows] = useState(seedData);

  const [tab, setTab] = useState("results");

  const [filters, setFilters] = useState({
    sic: "",
    startDate: "2023-01-01",
    endDate: "2024-12-31",
    minRevenue: "",
    maxRevenue: "",
  });

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const sicMatch =
        !filters.sic ||
        row.sic.startsWith(filters.sic);

      const dateMatch =
        row.filingDate >= filters.startDate &&
        row.filingDate <= filters.endDate;

      const minRevenue =
        !filters.minRevenue ||
        row.revenue >= Number(filters.minRevenue);

      const maxRevenue =
        !filters.maxRevenue ||
        row.revenue <= Number(filters.maxRevenue);

      return (
        sicMatch &&
        dateMatch &&
        minRevenue &&
        maxRevenue
      );
    });
  }, [rows, filters]);

  const includedRows = filteredRows.filter(
    (r) => r.include
  );

  const stats = [
    {
      metric: "Revenue",
      value: money(
        average(includedRows.map((r) => r.revenue))
      ),
    },
    {
      metric: "EV / Revenue",
      value: multiple(
        average(
          includedRows.map((r) => r.evRevenue)
        )
      ),
    },
    {
      metric: "EV / EBITDA",
      value: multiple(
        average(
          includedRows.map((r) => r.evEbitda)
        )
      ),
    },
  ];

  const distributionData = includedRows.map(
    (r) => ({
      company: r.company,
      evRevenue: r.evRevenue,
      revenue: r.revenue / 1000000,
    })
  );

  async function searchSEC() {
    const params = new URLSearchParams({
      sic: filters.sic,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });

    const response = await fetch(
      `/api/s1-search?${params}`
    );

    const data = await response.json();

    if (data.rows) {
      setRows(data.rows);
    }
  }

  function toggleInclude(id) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              include: !row.include,
            }
          : row
      )
    );
  }

  return (
    <div className="container">
      <div className="card">
        <h1>S-1 Valuation Screener</h1>

        <div className="filters">
          <input
            placeholder="SIC Code"
            value={filters.sic}
            onChange={(e) =>
              setFilters({
                ...filters,
                sic: e.target.value,
              })
            }
          />

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) =>
              setFilters({
                ...filters,
                startDate: e.target.value,
              })
            }
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) =>
              setFilters({
                ...filters,
                endDate: e.target.value,
              })
            }
          />

          <input
            type="number"
            placeholder="Min Revenue"
            value={filters.minRevenue}
            onChange={(e) =>
              setFilters({
                ...filters,
                minRevenue: e.target.value,
              })
            }
          />

          <input
            type="number"
            placeholder="Max Revenue"
            value={filters.maxRevenue}
            onChange={(e) =>
              setFilters({
                ...filters,
                maxRevenue: e.target.value,
              })
            }
          />

          <button onClick={searchSEC}>
            Search SEC
          </button>
        </div>
      </div>

      <div className="tabs">
        <div
          className={
            tab === "results"
              ? "tab active-tab"
              : "tab"
          }
          onClick={() => setTab("results")}
        >
          Results
        </div>

        <div
          className={
            tab === "stats"
              ? "tab active-tab"
              : "tab"
          }
          onClick={() => setTab("stats")}
        >
          Statistics
        </div>

        <div
          className={
            tab === "distribution"
              ? "tab active-tab"
              : "tab"
          }
          onClick={() =>
            setTab("distribution")
          }
        >
          Distribution
        </div>
      </div>

      {tab === "results" && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Include</th>
                <th>Company</th>
                <th>Location</th>
                <th>SIC</th>
                <th>Filing Date</th>
                <th>Revenue</th>
                <th>EBITDA</th>
                <th>EV/Revenue</th>
                <th>EV/EBITDA</th>
              </tr>
            </thead>

            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={() =>
                        toggleInclude(row.id)
                      }
                    />
                  </td>

                 <td>
  <a href={row.filingUrl} target="_blank" rel="noreferrer">
    {row.company}
  </a>
</td>

                  <td>{row.location}</td>

                  <td>{row.sic}</td>

                  <td>{row.filingDate}</td>

                  <td>
                    {money(row.revenue)}
                  </td>

                  <td>
                    {money(row.ebitda)}
                  </td>

                  <td>
                    {multiple(row.evRevenue)}
                  </td>

                  <td>
                    {multiple(row.evEbitda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "stats" && (
        <div className="card">
          <table className="metric-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Average</th>
              </tr>
            </thead>

            <tbody>
              {stats.map((stat) => (
                <tr key={stat.metric}>
                  <td>{stat.metric}</td>
                  <td>{stat.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "distribution" && (
        <div className="card chart-box">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <BarChart data={distributionData}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis dataKey="company" />

              <YAxis />

              <Tooltip />

              <Bar dataKey="evRevenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
