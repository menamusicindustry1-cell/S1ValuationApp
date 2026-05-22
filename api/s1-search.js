export default async function handler(req, res) {
  try {
    const { sic = "", startDate = "", endDate = "" } = req.query;

    const url =
      `https://efts.sec.gov/LATEST/search-index` +
      `?q=forms:"S-1"` +
      `&dateRange=custom` +
      `&startdt=${startDate}` +
      `&enddt=${endDate}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "S1 Valuation Screener oday_merhi@live.com",
        "Accept-Encoding": "gzip, deflate",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: "SEC request failed",
      });
    }

    const data = await response.json();

    const rows = (data.hits?.hits || [])
      .map((hit, index) => {
        const source = hit._source || {};
        const cik = source.ciks?.[0] || "";

        return {
          id: index + 1,
          company:
            source.display_names?.[0] ||
            source.company_name ||
            "Unknown",

          cik,

          filingDate: source.file_date || "",

          sic: source.sic || "",

          location:
            source.biz_locations?.[0] ||
            "Unknown",

          revenue: null,

          ebitda: null,

          evRevenue: null,

          evEbitda: null,

          filingUrl: source.adsh
            ? `https://www.sec.gov/Archives/edgar/data/${cik}/${source.adsh.replaceAll("-", "")}/${source.adsh}-index.html`
            : "#",

          include: true,
        };
      })
      .filter((row) => {
        if (!sic) return true;
        return row.sic?.startsWith(sic);
      });

    res.status(200).json({ rows });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
}
