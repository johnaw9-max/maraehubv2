// The marae's name and location for headers and forms. Only trustees may read the full
// marae_settings table now, so everyone else gets just these two fields from a database
// function. If the function is not on a database yet, fall back to reading the table.
export async function loadMaraeDisplay(supabase) {
  const { data, error } = await supabase.rpc('get_marae_display');
  if (!error && Array.isArray(data) && data[0]) {
    return { marae_name: data[0].marae_name || null, location: data[0].location || null };
  }
  const { data: row } = await supabase.from('marae_settings').select('marae_name, location').limit(1).maybeSingle();
  return { marae_name: row?.marae_name || null, location: row?.location || null };
}
