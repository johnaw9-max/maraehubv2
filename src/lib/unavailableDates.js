// Which dates can't be booked. Members cannot read other people's bookings or the
// committee's blocked dates, so the database answers with dates only (no names or
// reasons). If that function is not on this marae's database yet, fall back to reading
// the tables directly (works for trustees), so the forms keep behaving as before.

export async function loadUnavailable(supabase, excludeBookingId = null) {
  const { data, error } = await supabase.rpc('get_unavailable_dates', { p_exclude_booking: excludeBookingId });
  if (!error && Array.isArray(data)) {
    return data.map(r => ({ from: r.from_date, to: r.to_date, kind: r.kind }));
  }
  const [{ data: approved }, { data: blocked }] = await Promise.all([
    supabase.from('bookings').select('id, start_date, end_date').eq('status', 'approved'),
    supabase.from('blocked_dates').select('from_date, to_date'),
  ]);
  return [
    ...(approved || []).filter(b => b.start_date && b.id !== excludeBookingId)
      .map(b => ({ from: b.start_date, to: b.end_date || b.start_date, kind: 'booked' })),
    ...(blocked || []).filter(b => b.from_date && b.to_date)
      .map(b => ({ from: b.from_date, to: b.to_date, kind: 'blocked' })),
  ];
}

export function firstClash(ranges, start, end) {
  if (!start) return null;
  const e = end || start;
  return ranges.find(r => start <= r.to && e >= r.from) || null;
}

// Ranges that have not finished yet, soonest first.
export function upcomingRanges(ranges, today, limit = 8) {
  return ranges.filter(r => r.to >= today).sort((a, b) => a.from.localeCompare(b.from)).slice(0, limit);
}
