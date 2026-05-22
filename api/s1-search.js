export default async function handler(req, res) {
  try {
    const { sic = "", startDate = "", endDate = "" } = req.query;

    const headers = {
      "User-Agent": "S1 Valuation Screener oday_merhi@live.com",
      "Accept-Encoding": "gzip, deflate",
    };

    const searchUrl =
      `https://efts.sec.gov/LATEST/search-index` +
      `?q=forms:"S-1"` +
      `&dateRange=custom` +
      `&startdt=${startDate}` +
      `&enddt=${endDate}`;

    const searchResponse = await fetch(searchUrl, { headers });

    if (!searchResponse.ok) {
      return res.status(searchResponse.status).json({
        error: "SEC search failed",
      });
    }

    const searchData = await searchResponse.json();
    const hits = searchData.hits?.hits || [];

    const rows = [];

    for (const hit of hits) {
      const source = hit._source || {};

      // HARD FILTER: only true S-1 forms
      const form =
        source.form ||
        source.forms?.[0] ||
        source.root_form ||
        "";

      if (form !== "S-1") continue;

      const rawCik = source.ciks?.[0] || "";
      if (!rawCik) continue;

      const cik = rawCik.replace(/^0+/, "");
      const paddedCik = cik.padStart(10, "0");
      const accession = source.adsh || "";

      // Pull company submissions for SIC/location
      const subUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
      const subResponse = await fetch(subUrl, { headers });

      if (!subResponse.ok) continue;

      const sub = await subResponse.json();

      const sicCode = sub.sic || "";
      if (sic && !sicCode.startsWith(sic)) continue;

      // HARD FILTER: must have XBRL/company facts
      const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`;
      const factsResponse = await fetch(factsUrl, { headers });

      if (!factsResponse.ok) continue;

      const facts = await factsResponse.json();
      const usgaap = facts.facts?.["us-gaap"];

      if (!usgaap) continue;

      const revenue =
        latestFact(usgaap.Revenues) ||
        latestFact(usgaap.SalesRevenueNet);

      const operatingIncome =
        latestFact(usgaap.OperatingIncomeLoss);

      const depreciation =
        latestFact(usgaap.DepreciationDepletionAndAmortization) ||
        latestFact(usgaap.DepreciationDepletionAndAmortizationExpense);

      let ebitda = null;

      if (operatingIncome !== null && depreciation !== null) {
        ebitda = operatingIncome + depreciation;
      }

      rows.push({
        id: rows.length + 1,
        company: sub.name || source.display_names?.[0] || "Unknown",
        cik,
        form,
        filingDate: source.file_date || "",
        sic: sicCode,
        sicDescription: sub.sicDescription || "",
        location: [
          sub.addresses?.business?.city,
          sub.addresses?.business?.stateOrCountry,
        ]
          .filter(Boolean)
          .join(", "),
        revenue,
        ebitda,
        evRevenue: null,
        evEbitda: null,
        filingUrl: accession
          ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replaceAll(
              "-",
              ""
            )}/${accession}-index.html`
          : "#",
        include: true,
      });
    }

    res.status(200).json({ rows });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
}

function latestFact(factObj) {
  if (!factObj?.units) return null;

  const units =
    factObj.units.USD ||
    Object.values(factObj.units)[0];

  if (!Array.isArray(units)) return null;

  const clean = units
    .filter((item) => item.val !== undefined && item.end)
    .sort((a, b) => String(b.end).localeCompare(String(a.end)));

  return clean[0]?.val ?? null;
}
