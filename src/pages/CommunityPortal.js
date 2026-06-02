import React, { useState } from 'react';
import Header from '../components/Header';
import BookingWizard from '../components/BookingWizard';
import BookingsManager from '../components/BookingsManager';
import NoticeboardManager from '../components/NoticeboardManager';
import CalendarView from '../components/CalendarView';
import FeedbackButton from '../components/FeedbackButton';
import HelpMenu from '../components/HelpMenu';

const TABS = [
  { key: 'noticeboard', label: 'Noticeboard' },
  { key: 'book', label: 'Book the Marae' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'mybookings', label: 'My Bookings' },
];

export default function CommunityPortal({ profile, onLogout }) {
  const [activeTab, setActiveTab] = useState('book');

  return (
    <div>
      <Header profile={profile} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} />
      <div className="main">
        {activeTab === 'noticeboard' && <NoticeboardManager isTrustee={false} profile={profile} />}
        {activeTab === 'book' && (
          <BookingWizard profile={profile} onBooked={() => setActiveTab('mybookings')} />
        )}
        {activeTab === 'calendar' && <CalendarView isTrustee={false} />}
        {activeTab === 'mybookings' && (
          <BookingsManager isTrustee={false} userId={profile?.id} />
        )}
      </div>
      <div className="footer">MaraeHub NZ Ltd · maraehub.com · Serving urban Māori communities across Aotearoa</div>
      <FeedbackButton profile={profile} />
      <HelpMenu role="community" />
    </div>
  );
}
