// GridGuardian AI — API client.
// Requests go to "/api" (Vite dev server proxies to the FastAPI backend).
// An alternative base can be supplied via VITE_API_URL at build time.

const BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

async function request(method, path, payload) {
  const init = { method, headers: {} };
  if (payload !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(payload);
  }
  const res = await fetch(`${BASE}${path}`, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const detail =
      body && typeof body === "object" && body.detail
        ? String(body.detail).replace(/^.*\[body\]\s*/, "")
        : `Request failed (${res.status})`;
    const err = new Error(detail);
    err.status = res.status;
    throw err;
  }
  return body;
}

export const apiGet = (path) => request("GET", path);
export const apiPost = (path, payload) => request("POST", path, payload);

export function getHealth() {
  return apiGet("/health");
}

export function getDashboardSummary() {
  return apiGet("/dashboard/summary");
}

export function listAssets({
  riskCategory,
  priorityCategory,
  criticality,
  assetType,
  search,
  limit = 25,
  offset = 0,
  sort = "priority",
} = {}) {
  const params = new URLSearchParams();
  if (riskCategory) params.set("risk_category", riskCategory);
  if (priorityCategory) params.set("priority_category", priorityCategory);
  if (criticality) params.set("criticality", criticality);
  if (assetType) params.set("asset_type", assetType);
  if (search) params.set("search", search);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  params.set("sort", sort);
  return apiGet(`/assets?${params.toString()}`);
}

export function getAsset(id) {
  return apiGet(`/assets/${encodeURIComponent(id)}`);
}

export function getAssetsPage({ search, riskCategory, priorityCategory, criticality, assetType, sort = "priority", page = 0, pageSize = 20 } = {}) {
  return listAssets({
    search,
    riskCategory,
    priorityCategory,
    criticality,
    assetType,
    sort,
    limit: pageSize,
    offset: page * pageSize,
  });
}

export function getAssetSimulation(id) {
  return apiGet(`/assets/${encodeURIComponent(id)}/simulation`);
}

export function simulateAsset(id) {
  return apiPost("/simulation", { asset_id: id });
}

export function simulateCompare(ids) {
  return apiPost("/simulation/compare", { asset_ids: ids });
}

export function getDemoPicks() {
  return apiGet("/simulation/demo");
}

export function priorityRanking(limit = 50) {
  return apiGet(`/priority/ranking?limit=${limit}`);
}

export function allocateCrews(crews) {
  return apiPost("/priority/allocate", { crews });
}

export function getAlerts({ severity } = {}) {
  const params = new URLSearchParams();
  params.set("limit", "100");
  if (severity && severity !== "all") params.set("severity", severity);
  return apiGet(`/alerts?${params.toString()}`);
}

export function generateAiBrief(ids) {
  return apiPost("/ai/brief", { asset_ids: ids });
}

export function getModelFeatures() {
  return apiGet("/model/features");
}