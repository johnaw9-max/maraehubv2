import React, { useState } from 'react';
import Header from '../components/Header';
import BookingWizard from '../components/BookingWizard';
import BookingsManager from '../components/BookingsManager';

const TABS = [
  { key: 'book', label: 'Book the Marae' },
  { key: 'mybookings', label: 'My Bookings' },
];

export default function CommunityPortal({ profile, onLogout }) {
  const [activeTab, setActiveTab] = useState('book');

  return (
    <div>
      <Header profile={profile} onLogout={onLogout} activeTab={activeTab} setActiveTab={setActiveTab} tabs={TABS} />
      <div className="main">
        {activeTab === 'book' && (
          <BookingWizard profile={profile} onBooked={() => setActiveTab('mybookings')} />
        )}
        {activeTab === 'mybookings' && (
          <BookingsManager isTrustee={false} userId={profile?.id} />
        )}
      </div>
      <div className="footer">MaraeHub NZ Ltd · maraehub.com · Serving urban Māori communities across Aotearoa</div>
    </div>
  );
}
