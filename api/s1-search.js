export default async function handler(req, res) {
  try {
    const { sic = "", startDate = "", endDate = "" } = req.query;

    const searchUrl =
      `https://efts.sec.gov/LATEST/search-index` +
      `?q=forms:"S-1"` +
      `&dateRange=custom` +
      `&startdt=${startDate}` +
      `&enddt=${endDate}`;

    const headers = {
      "User-Agent": "S1 Valuation Screener oday_merhi@live.com",
      "Accept-Encoding": "gzip, deflate",
    };

    const searchResponse = await fetch(searchUrl, { headers });

    if (!searchResponse.ok) {
      return res.status(searchResponse.status).json({
        error: "SEC search failed",
      });
    }

    const searchData = await searchResponse.json();
    const hits = searchData.hits?.hits || [];

    const rows = [];

    for (const [index, hit] of hits.entries()) {
      const source = hit._source || {};
      const rawCik = source.ciks?.[0] || "";
      const cik = rawCik.replace(/^0+/, "");
      const paddedCik = cik.padStart(10, "0");
      const accession = source.adsh || "";

      let sicCode = "";
      let sicDescription = "";
      let location = "";
      let companyName = source.display_names?.[0] || source.company_name || "Unknown";
      let revenue = null;
      let ebitda = null;

      try {
        const subUrl = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
        const subResponse = await fetch(subUrl, { headers });

        if (subResponse.ok) {
          const sub = await subResponse.json();

          sicCode = sub.sic || "";
          sicDescription = sub.sicDescription || "";
          location = [sub.addresses?.business?.city, sub.addresses?.business?.stateOrCountry]
            .filter(Boolean)
            .join(", ");

          companyName = sub.name || companyName;
        }
      } catch {}

      if (sic && !sicCode.startsWith(sic)) continue;

      try {
        const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`;
        const factsResponse = await fetch(factsUrl, { headers });

        if (factsResponse.ok) {
          const facts = await factsResponse.json();
          const usgaap = facts.facts?.["us-gaap"] || {};

          revenue = latestFact(usgaap.Revenues) || latestFact(usgaap.SalesRevenueNet);

          const operatingIncome = latestFact(usgaap.OperatingIncomeLoss);
          const depreciation = latestFact(usgaap.DepreciationDepletionAndAmortization);

          if (operatingIncome !== null && depreciation !== null) {
            ebitda = operatingIncome + depreciation;
          }
        }
      } catch {}

      rows.push({
        id: index + 1,
        company: companyName,
        cik,
        filingDate: source.file_date || "",
        sic: sicCode,
        sicDescription,
        location: location || "Unknown",
        revenue,
        ebitda,
        enterpriseValue: null,
        evRevenue: null,
        evEbitda: null,
        filingUrl: accession
          ? `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replaceAll("-", "")}/${accession}-index.html`
          : "#",
        include: true,
      });
    }

    res.status(200).json({ rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

function latestFact(factObj) {
  if (!factObj?.units) return null;

  const units = factObj.units.USD || factObj.units.shares || Object.values(factObj.units)[0];

  if (!Array.isArray(units)) return null;

  const annual = units
    .filter((item) => item.val !== undefined && item.fy && item.fp === "FY")
    .sort((a, b) => String(b.end).localeCompare(String(a.end)));

  return annual[0]?.val ?? null;
}
