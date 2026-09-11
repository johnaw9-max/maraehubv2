// Real vs. poor-condition assets, per AssetsManager's own documented definition:
// 'critical' and 'poor' both mean the asset needs attention, and Inventory items
// (consumables) are excluded because condition tracking is for physical assets,
// not stock. TrusteeDashboard's KPI tile previously disagreed with this
// (14yhc7kpea8 Step 3), the same class of bug fixed for resolutions in resolutionStatus.js.
export const POOR_ASSET_CONDITIONS = ['poor', 'critical'];

export function isAssetInPoorCondition(asset) {
  return asset.category !== 'Inventory' && POOR_ASSET_CONDITIONS.includes(asset.condition);
}
