jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
import { parseSourceMeeting } from './SourceHuiLink';

describe('parseSourceMeeting', () => {
  it('reads the hui id from a task description', () => {
    expect(parseSourceMeeting('Meeting action assigned. [source_id:a1] [source_meeting:abc-123]')).toBe('abc-123');
  });
  it('returns null when there is no marker', () => {
    expect(parseSourceMeeting('Meeting action assigned. [source_id:a1]')).toBeNull();
    expect(parseSourceMeeting(null)).toBeNull();
  });
});
