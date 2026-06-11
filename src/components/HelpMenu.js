import React, { useState } from 'react';

const HELP_TOPICS = {
  trustee: [
    {
      category: 'Bookings',
      icon: '📅',
      items: [
        { q: 'How do I approve a booking?', a: 'Go to the Bookings tab. You will see all pending requests. Click the green "Approve" button to confirm a booking, or the red "Decline" button to reject it. The community member will need to check back to see the status.' },
        { q: 'How do I block dates so no one can book?', a: 'Go to the Calendar tab and click "Block Dates" in the top right. Enter the dates and a reason (e.g. Maintenance, Private event). Blocked dates show in red on the calendar and prevent community members from booking those days.' },
        { q: 'Can I see all upcoming bookings?', a: 'Yes — go to the Calendar tab to see a visual overview of all approved bookings and blocked dates. You can also go to the Bookings tab and filter by status (pending, approved, declined).' },
        { q: 'How do I complete the exit checklist?', a: 'After a booking, go to the Bookings tab, find the relevant booking, and click "Checklist". Tick off each item — cleaning, securing the building, returning keys, etc — and submit. This creates an accountability record for the marae and confirms the hirers met their obligations.' },
        { q: 'How do I view feedback ratings?', a: 'After a booking, community members can submit star ratings and comments. Go to the Bookings tab and click on a completed booking to see any feedback received. An overall summary of ratings across all bookings is also shown on the main Dashboard under Community Feedback Reports.' },
      ]
    },
    {
      category: 'Minutes',
      icon: '📝',
      items: [
        { q: 'How do I record a meeting?', a: 'Go to the Minutes tab and click "+ New Meeting". Fill in the meeting title, date, type (Trustee Meeting, AGM, Special Meeting, etc), chairperson, secretary, and attendees. Click "Save Meeting" to create the record. You can then open the meeting to add resolutions and action items.' },
        { q: 'How do I add a resolution?', a: 'Open a meeting from the Minutes tab and click the "Resolutions" section, then "+ Add Resolution". Enter the resolution number, a description of what was resolved, and the date it was passed. As progress is made, update the status — Open, In Progress, Completed, or Cancelled.' },
        { q: 'How do I assign an action?', a: 'Open a meeting and go to the "Actions" section, then click "+ Add Action". Describe the action required, assign it to a trustee or community member using the dropdown, and set a due date. Actions show as Open until marked complete — click "Edit" on any action to update its status.' },
      ]
    },
    {
      category: 'Projects',
      icon: '📋',
      items: [
        { q: 'How do I add a new project?', a: 'Go to the Projects tab and click "+ Add Project". Fill in the project name, status, lead person, and due date. You can update the progress percentage as work gets done.' },
        { q: 'How do I add subtasks to a project?', a: 'Click on any project to open it, then click "+ Add Subtask". You can set a subtask name, assignee, due date, and priority. Tick subtasks off as they are completed — the project progress updates automatically.' },
        { q: 'How do I switch to board view?', a: 'In the Projects tab, look for the view toggle near the top right of the page. Click "Board" to switch to the kanban-style column view which organises projects by status: Planning, Active, Review, and Completed. Click "List" to return to the list view.' },
        { q: 'How do I move a project between columns?', a: 'In Board view, each project card has ← and → arrow buttons. Click → to advance the project to the next status column (e.g. Planning → Active → Review → Completed), or ← to move it back. You can also edit the project and change the status directly from the form.' },
      ]
    },
    {
      category: 'Grants',
      icon: '💰',
      items: [
        { q: 'How do I track a grant?', a: 'Go to the Grants tab and click "+ Add Grant". Enter the grant name, funder, amount, category, and deadline. As you progress, update the status to reflect where you are in the process. The KPI tiles at the top show your overall success rate, total approved funding, and any urgent upcoming deadlines.' },
        { q: 'What do the status options mean?', a: 'Researching — you are looking into whether to apply. In-Progress — you are actively writing the application. Submitted — the application has been sent and you are waiting for a decision. Approved or Declined — the outcome. Reporting — funding has been received and you are completing required progress reports.' },
      ]
    },
    {
      category: 'Tasks',
      icon: '✅',
      items: [
        { q: 'How do I add a task?', a: 'Go to the Tasks tab and click "+ Add Task". Enter a title, optional description, assign it to someone from the dropdown, set a due date, and choose a priority — High, Medium, or Low. New tasks start in the Open column. High priority tasks show a red left border, Medium is amber, and Low is green. Overdue tasks are flagged with a red OVERDUE label.' },
        { q: 'How do I move a task between columns?', a: 'Each task card has ← and → arrow buttons at the bottom. Click → to move the task forward through the columns: Open → In Progress → Completed → Cancelled. Click ← to move it back. Tasks moved into Completed are automatically time-stamped, which updates the "Completed Today" KPI tile.' },
      ]
    },
    {
      category: 'Assets',
      icon: '🏗️',
      items: [
        { q: 'How do I add a service reminder?', a: 'Go to the Assets tab, find the asset you want to set a reminder for, and click the "🔔 Reminders" button. Click "+ Add Reminder", enter the service type, due date, and how often it repeats (monthly, annually, etc).' },
        { q: 'What does "Mark as Serviced" do?', a: 'When a reminder is overdue, you can click "Mark as Serviced" to confirm the service was done. If the reminder is recurring (e.g. annual), it will automatically set the next due date forward by the correct interval.' },
      ]
    },
    {
      category: 'Contacts',
      icon: '👥',
      items: [
        { q: 'How do I add a new trustee or community member?', a: 'Go to the Contacts tab and click "+ Add User". Enter their full name, email address, a temporary password, and choose their role — Trustee or Community Member. They can log in straight away with those details. You can change their role at any time using the "Make Trustee" or "Make Community" buttons on their row.' },
        { q: 'How do I add a contractor?', a: 'Go to the Contacts tab and click "+ Add Contractor" (visible when the "All" or "Contractors" filter is selected). Fill in their name, trade (Plumber, Electrician, Builder, etc), company, phone, email, address, and any notes such as rates or availability. Use the Preferred toggle to mark them as your go-to for that trade.' },
        { q: 'How do I mark a contractor as preferred?', a: 'On any contractor card in the Contacts tab, click the ☆ star icon in the top-right corner to toggle their preferred status on or off. Preferred contractors display a ⭐ Preferred badge on their card. You can also set this when adding or editing a contractor using the toggle switch in the form.' },
      ]
    },
    {
      category: 'Compliance Tracker',
      icon: '✅',
      items: [
        { q: 'What does the Compliance Tracker do?', a: 'The Compliance Tracker helps your marae stay on top of all legal and operational obligations in one place — so you never miss a renewal, inspection, or review deadline. You can track Building Warrants of Fitness, insurance renewals, trustee term limits, Health & Safety obligations, Civil Defence emergency plans, and log any incidents that occur at marae events.' },
        { q: 'How do I add a compliance item?', a: 'Go to the Compliance tab in the main navigation and click "Add Item". Select the type of compliance item (e.g. Building, Insurance, Trustee, Health & Safety), enter the due date, responsible person, and any notes. You can also upload a supporting document such as a WOF certificate. Save — the item will appear in your compliance list sorted by urgency.' },
        { q: 'What do the traffic light colours mean?', a: 'Green (Compliant) — no action needed, the item is up to date. Orange (Due Soon) — the item is due within 30 days, review it soon. Red (Overdue) — the item is past its due date and requires immediate attention.' },
        { q: 'How do I log an incident?', a: 'Go to the Compliance tab and click the "Incident Register" section, then "+ Log Incident". Enter the date, a title, description, location, severity level (Minor, Moderate, Serious, Critical), people involved, and any action taken. You can upload a supporting document and set a follow-up date. Once resolved, click "Resolve" to close the incident.' },
        { q: 'Does it connect to the Board View?', a: 'Yes. Overdue and due-soon compliance items automatically appear as red alerts in the Board View Smart Insights panel. Trustees see a summary at the start of every meeting without needing to open the Compliance tab separately.' },
        { q: 'Who can access the Compliance Tracker?', a: 'Trustees only. The community role cannot access this module. This is intentional — marae are PCBUs under the Health and Safety at Work Act 2015 and trustees have personal legal liability for compliance. The tracker protects trustees by keeping a digital record of all obligations and actions taken.' },
      ]
    },
    {
      category: 'Goals & Reporting',
      icon: '🎯',
      items: [
        { q: 'What does Goals & Reporting do?', a: 'Goals & Reporting helps your committee track strategic goals and see progress automatically using data already stored in MaraeHub. It is not a task list — it is a governance and reporting tool that gives trustees a clear view of how the marae is tracking against its plans. You can set goals, link them to existing projects, compliance items and grants, and watch progress update automatically.' },
        { q: 'What are the Goal Categories?', a: 'Governance — committee structure, elections, handover. Compliance — WOFs, insurance, H&S, Civil Defence. Projects — capital works, renovation, infrastructure. Funding — grants, applications, income targets. Community — events, engagement, whānau. Assets — equipment, maintenance, vehicles. Finance and Whakapapa categories are planned for a future release.' },
        { q: 'How do I add a goal?', a: 'Go to the Goals tab and click "+ Add Goal". Enter the goal name, description, and category. Set a target date and assign a responsible trustee. Optionally link the goal to a related project, compliance item, or grant — progress will then update automatically from that linked data. Set an initial progress percentage and status, then save. The goal appears in your Goals list and the Board Report.' },
        { q: 'What do the status options mean?', a: 'Not Started — the goal is in the planning phase and work has not begun. In Progress — the committee is actively working toward this goal. At Risk — progress has fallen behind schedule or faces an obstacle. Completed — the goal has been achieved.' },
        { q: 'What do the traffic light colours mean in the Board Report?', a: 'Green (On Track) — the goal is progressing well and the target date is not at risk. Orange (At Risk) — the goal is flagged as at risk, or the target date is within 14 days. Red (Behind Schedule) — the target date has passed and the goal is not yet complete. Grey means the goal has not started and the target date is still in the future.' },
        { q: 'Why does progress update automatically?', a: 'When you link a goal to a project, the project\'s progress percentage is used directly. When linked to a compliance item, the status (Compliant, Due Soon, Overdue) is converted to a progress score. When linked to a grant, the grant\'s stage (Researching through to Approved) is converted to a percentage. This means trustees do not need to manually update every goal — MaraeHub does it for them.' },
        { q: 'Who can see Goals & Reporting?', a: 'Trustees only. The community role cannot access this module. Goals & Reporting exists to keep the committee accountable and give every trustee visibility of progress — without anyone needing to manually chase updates.' },
      ]
    },
    {
      category: 'Documents',
      icon: '📁',
      items: [
        { q: 'How do I upload a document?', a: 'Go to the Documents tab and click "+ Upload Document". You can drag and drop a file or click to browse. Add a title and category (Governance, Finance, Legal, etc) then click Save.' },
        { q: 'What file types can I upload?', a: 'You can upload PDFs, Word documents, Excel spreadsheets, and images. All important marae documents like the charter, trust deed, and policies can be stored here.' },
      ]
    },
    {
      category: 'Settings',
      icon: '⚙️',
      items: [
        { q: 'How do I change the marae name?', a: 'Go to the Settings tab. You can update the marae name, location, iwi, hapū, and contact details. Click "Save Settings" and the name will update across the whole platform immediately.' },
      ]
    },
  ],
  community: [
    {
      category: 'Booking',
      icon: '📅',
      items: [
        { q: 'How do I book the marae?', a: 'Click "Book the Marae" in the top navigation. Follow the 3 steps: choose your occasion type, select your dates and number of guests, then fill in your details and submit. The committee will review and confirm within 2-3 working days.' },
        { q: 'How do I know if my booking is confirmed?', a: 'Go to "My Bookings" to check the status of your request. It will show as Pending while the committee reviews it, then Approved or Declined once they decide.' },
        { q: 'What if my dates are not available?', a: 'If you select dates that are already booked or blocked, you will see a message saying the marae is not available. Try selecting different dates — the calendar shows which dates are taken.' },
        { q: 'How do I leave feedback on a booking?', a: 'After your booking date has passed, go to "My Bookings" and click "Leave Feedback" on the completed booking. Rate the overall experience, cleanliness, and facilities out of 5 stars, and add any comments you\'d like to share. Your feedback helps the committee improve the marae for the whole community.' },
      ]
    },
    {
      category: 'Calendar',
      icon: '🗓️',
      items: [
        { q: 'How do I see when the marae is available?', a: 'Go to the Calendar tab. Green dates have approved bookings, red dates are blocked by the committee, and white dates are available. Use the arrows to navigate between months.' },
      ]
    },
    {
      category: 'Noticeboard',
      icon: '📢',
      items: [
        { q: 'Where do I see announcements?', a: 'Go to the Noticeboard tab. The committee posts notices here about upcoming events, closures, maintenance, and other important information. You can filter by category — Urgent, Event, General, or Maintenance.' },
      ]
    },
  ]
};

export default function HelpMenu({ role }) {
  const [open, setOpen] = useState(false);
  const [openItem, setOpenItem] = useState(null);
  const [search, setSearch] = useState('');

  const topics = HELP_TOPICS[role] || HELP_TOPICS.community;

  const filteredTopics = search.trim()
    ? topics.map(cat => ({
        ...cat,
        items: cat.items.filter(item =>
          item.q.toLowerCase().includes(search.toLowerCase()) ||
          item.a.toLowerCase().includes(search.toLowerCase())
        )
      })).filter(cat => cat.items.length > 0)
    : topics;

  return (
    <>
      {/* HELP BUTTON */}
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed', bottom: 24, left: 24, zIndex: 500,
          background: '#fff', color: 'var(--brand)',
          border: '2px solid var(--brand)', borderRadius: 50, padding: '12px 20px',
          fontSize: 13, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(26,74,58,0.15)',
          fontFamily: 'DM Sans, sans-serif',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
        ❓ Help
      </button>

      {/* PANEL */}
      {open && (
        <div
          onClick={e => e.target === e.currentTarget && setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'stretch', justifyContent: 'flex-start',
            zIndex: 1000,
          }}>
          <div style={{
            background: '#fff', width: '100%', maxWidth: 440,
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>
            {/* HEADER */}
            <div style={{ background: 'var(--brand)', padding: '20px 24px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontFamily: 'Playfair Display, serif', fontSize: 20, fontWeight: 600, color: '#fff' }}>Help Centre</div>
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'rgba(255,255,255,0.7)' }}>✕</button>
              </div>
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search for help..."
                style={{
                  width: '100%', padding: '10px 14px',
                  border: 'none', borderRadius: 8,
                  fontSize: 13, fontFamily: 'DM Sans, sans-serif',
                  background: 'rgba(255,255,255,0.15)', color: '#fff',
                }}
              />
            </div>

            {/* TOPICS */}
            <div style={{ padding: '16px 24px', flex: 1 }}>
              {filteredTopics.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
                  <div>No results found for "{search}"</div>
                </div>
              ) : filteredTopics.map(cat => (
                <div key={cat.category} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>{cat.icon}</span>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{cat.category}</div>
                  </div>
                  {cat.items.map((item, i) => {
                    const key = `${cat.category}-${i}`;
                    const isOpen = openItem === key;
                    return (
                      <div key={i} style={{ marginBottom: 6, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                        <div
                          onClick={() => setOpenItem(isOpen ? null : key)}
                          style={{
                            padding: '12px 14px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: isOpen ? '#eaf4f0' : 'var(--surface2)',
                          }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text1)', flex: 1, paddingRight: 8 }}>{item.q}</div>
                          <div style={{ fontSize: 16, color: 'var(--text3)', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</div>
                        </div>
                        {isOpen && (
                          <div style={{ padding: '12px 14px', background: '#fff', borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                            {item.a}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div style={{ marginTop: 24, padding: '16px', background: 'var(--cream)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', marginBottom: 4 }}>Still need help?</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Use the 💬 Feedback button to send us a question and we'll get back to you.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
