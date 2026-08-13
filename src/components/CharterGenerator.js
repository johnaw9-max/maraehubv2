import React, { useState } from 'react';
import FormError from './FormError';

// Master template sourced directly from Marae-Charter.docx (Marae Kete /
// Western Bay of Plenty District Council), read and converted 14 August
// 2026. Wording and spelling preserved verbatim from the source -- the
// only deviations are dropping stray empty bullet-list artifacts and one
// literal duplicated line ("...kawa and titkanga." / "...kawa and
// tikanga."), and leaving the signature block blank rather than
// auto-filling trustee names, all confirmed before building.

const FIELDS = [
  { key: 'marae_name',        label: 'Marae Name',                          placeholder: 'e.g. Aroha' },
  { key: 'hapu_name',         label: 'Hapū Name (without "Ngāti")',         placeholder: 'e.g. Whātua' },
  { key: 'iwi_name',          label: 'Iwi Name',                            placeholder: 'e.g. Ngāti Whātua' },
  { key: 'street_address',    label: 'Street Address (Road)',               placeholder: 'e.g. 123 Marae' },
  { key: 'town',              label: 'Town / Locality',                     placeholder: 'e.g. Manurewa, Auckland' },
  { key: 'legal_description', label: 'Legal Description of the Land',       placeholder: 'e.g. Lot 1 DP 12345' },
  { key: 'block_name',        label: 'Block Name',                          placeholder: 'e.g. Manurewa 2B' },
];

// Genuine points of legitimate variation between marae, per first-principles
// review, 14 August 2026. Deliberately excludes the disqualification
// criteria and core legal structure -- those stay fixed to protect the
// document's legal soundness.
const GOVERNANCE_FIELDS = [
  { key: 'trustee_count',    label: 'Number of Trustees',                                  placeholder: 'e.g. nine' },
  { key: 'trustee_term',     label: 'Trustee Term Length',                                 placeholder: 'e.g. three years' },
  { key: 'meeting_frequency',label: 'Meeting Frequency',                                   placeholder: 'e.g. every quarter' },
  { key: 'quorum_percent',   label: 'Quorum Percentage',                                   placeholder: 'e.g. 60', type: 'number' },
  { key: 'missed_meetings',  label: 'Consecutive Missed Meetings Before Deemed Resigned',  placeholder: 'e.g. three' },
];

const ALL_FIELDS = [...FIELDS, ...GOVERNANCE_FIELDS];

const EMPTY_FORM = ALL_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildCharterHtml(f) {
  const marae     = escapeHtml(f.marae_name.trim());
  const hapu      = escapeHtml(f.hapu_name.trim());
  const iwi       = escapeHtml(f.iwi_name.trim());
  const street    = escapeHtml(f.street_address.trim());
  const town      = escapeHtml(f.town.trim());
  const legalDesc = escapeHtml(f.legal_description.trim());
  const block     = escapeHtml(f.block_name.trim());
  const trusteeCount   = escapeHtml(f.trustee_count.trim());
  const trusteeTerm    = escapeHtml(f.trustee_term.trim());
  const meetingFreq    = escapeHtml(f.meeting_frequency.trim());
  const quorum          = `${escapeHtml(f.quorum_percent.trim())}%`;
  const missedMeetings = escapeHtml(f.missed_meetings.trim());
  const sigLines  = Array.from({ length: 8 }, () => `<div class="sig-line">Signed by <span></span></div>`).join('');

  return `<!DOCTYPE html><html><head><title>Marae Charter — ${marae}</title>
<style>
body{font-family:Georgia,serif;max-width:840px;margin:40px auto;color:#222;line-height:1.7}
h1{font-size:24px;text-align:center;border-bottom:2px solid #1a4a3a;padding-bottom:8px}
h1 .sub{display:block;font-size:15px;font-weight:normal;margin-top:6px}
h2{font-size:16px;margin-top:26px;color:#1a4a3a}
p{font-size:13px;margin:10px 0}
ul{font-size:13px;padding-left:22px}
.sig-line{margin:22px 0;font-size:13px}
.sig-line span{display:inline-block;border-bottom:1px solid #222;min-width:320px;margin-left:6px}
</style></head><body>

<h1>${marae} Marae<span class="sub">Charter for Ngāti ${hapu} Marae Trustees</span></h1>

<h2>Purpose</h2>
<p>The purpose of this Charter is to set out the role, rules, responsibilities and relationships of the ${marae} Marae Trustees to the ${marae} Marae Committee and to the hapū and beneficiaries of the ${marae} Marae.</p>

<h2>Iwi and Hapū Affiliations</h2>
<p>The Iwi that ${marae} Marae affiliates to is ${iwi}.</p>
<p>The hapū identified by ${marae} is Ngāti ${hapu}.</p>
<p>Ngāti ${hapu} hapū will strictly adhere to the kawa of ${iwi} Iwi and the tikanga pertaining to Ngāti ${hapu} which will be kept in the ${marae} Marae office and available for inspection if requested by any beneficiary.</p>

<h2>Name</h2>
<p>The organisation, premises and facilities shall be known as ${marae} Marae, hereinafter referred to as the Marae.</p>

<h2>Legal Description and Location</h2>
<p>The Marae is a Marae Reservation.</p>
<p>The Marae is located at ${street} Road, ${town}</p>
<p>The legal description of the land is ${legalDesc}.</p>
<p>The block name is ${block}</p>

<h2>Management</h2>
<p>There shall be a Board of Trustees of the Marae, hereinafter referred to as The Board.</p>
<p>The Board shall comprise of ${trusteeCount} duly elected members, so elected by the beneficiaries and such election to be noted in the records of the Māori Land Court.</p>
<p>There shall be a Chairperson appointed by the Board members, who will serve for a period of up to ${trusteeTerm}.</p>
<p>There shall be a Deputy Chairperson appointed by the Board members, who will serve for a period of up to ${trusteeTerm}.</p>
<p>There shall be a Secretary appointed by the Board members, who will serve for a period of up to ${trusteeTerm}.</p>
<p>All elected Board members shall serve for a period of up to ${trusteeTerm}, but may stand for re-election if so nominated by the beneficiaries</p>
<p>The special place of kaumātua (elders) is acknowledged.  They are always present to offer guidance to the Board.</p>

<h2>Appointment of Trustees</h2>
<p>All beneficiaries being of Ngāti ${hapu} are eligible for appointment as a Trustee unless they are one of the following persons:</p>
<ul>
  <li>An undischarged bankrupt.</li>
  <li>A person who is subject to a Compulsory Treatment under Part 11 of the Mental Health Act 1992.</li>
  <li>A person convicted of any offence punishable by imprisonment for a term of six months or more, unless that sentence has been served or otherwise suffered the penalty imposed.</li>
</ul>
<p>Nominations for Trustees will be applied in the open forum situation and nominations in writing will be accepted in the absence of the nominee.</p>
<p>All nominations must be seconded.</p>
<p>Voting for election of nominees shall be by show of hands.  Vacancies on the Board shall be filled by way of an election to be held at a Special General Meeting for this purpose.</p>
<p>Elections of Trustees shall be held at Annual General Meeting or at such time and place that the Board may decide.  If elections of Trustees are not at the Annual General Meeting, then there shall be public notice in the local paper giving a minimum of one month's notice of the specially called meeting.</p>
<p>At any Annual or Special General Meeting called there shall be a minimum quorum of ${quorum} Trustees and 4 beneficiaries of the Marae present before voting is allowed.</p>
<p>Beneficiaries of the Marae are able to vote at any Annual or Special General Meeting but cannot vote at Ordinary Board meetings, unless specifically agreed to by the Chairperson and Trustee present.</p>

<h2>Trustees Responsibilities</h2>
<p>The Board shall delegate its responsibilities for the efficient and effective day to day running of the Marae to the Marae Committee.</p>
<p>The Trustees shall be responsible for maintaining the kawa and tikanga for the Marae.  This may be by:</p>
<ul>
  <li>Maintaining contact with the ${iwi} Iwi and with other Iwi.</li>
  <li>Maintaining contact with other identified hapū.</li>
  <li>Maintaining the integrity of our kawa and tikanga according to our heritage and history.</li>
  <li>Supporting kaumātua in ensuring Manuhiri and Tangata Whenua are informed of our kawa and tikanga.</li>
  <li>Ensuring the protocols and principles operating on our Marae are consistent with kawa and tikanga.</li>
  <li>Providing clear direction on the use of the Marae Ātea and other whenua associated with our Marae for hui and tangihanga; and</li>
  <li>Supporting our whānau to maintain our Urupā.</li>
</ul>
<p>The Trustees shall also be responsible to inform the Marae Committee(s) of issues that are of concern to them, which the Marae Committee(s) should deal with, in consultation with the Trustees.</p>
<p>The Trustees shall be represented on each Marae Committee or Marae sub-committee as an Advisory member of that Committee.  Their primary role is to work with both the Trustees and the Marae Committee to ensure that all communication is open and honest.</p>
<p>The Trustees will require that the Marae Committee, or other Committee operating on the Marae, inform the Board of:</p>
<ul>
  <li>Any significant activity likely to affect the Marae i.e. alterations</li>
  <li>Any activity likely to have financial implications on hapū and beneficiaries of the Marae; and</li>
  <li>Any long-term (more than five years for example) effect on the Marae or its whenua.</li>
</ul>

<h2>Meetings</h2>
<p>The ${marae} Marae Trustees (hereinafter referred to as the Board) shall meet regularly ${meetingFreq} or at any other mutually agreed time, for the purpose of on-going management of the Marae.</p>
<p>A quorum of ${quorum} of the Board must be established before the meeting is opened, so that any decisions made at the regular meetings shall be binding.</p>
<p>If a quorum is not established at the regular meeting, the meeting may proceed, but any decisions made shall not be binding until ratified by a majority of the Board.</p>
<p>Annual General Meetings will be held within three months of the end of the financial year.  The purpose of the Annual General Meetings is to:</p>
<ul>
  <li>Elect new Trustees (if required).</li>
</ul>
<p>And may also be to:</p>
<ul>
  <li>Present an account of the achievements of the year.</li>
  <li>Project the Board's objectives for the following year.</li>
  <li>Discuss any other business of the Marae as required by the meeting.</li>
</ul>
<p>Notification of the Annual General Meetings will be made through the local media one month (28 days) prior to the meeting.</p>
<p>Special General Meetings may be called by the Board at any one time as deemed necessary, for which one month's notice will be given, OR, at least all Trustees are notified as a matter of urgency where any emergency exists.  A Special General Meeting must be called if the number of Trustees falls below ${quorum} for whatever reason.</p>
<p>If a Trustee fails to attend ${missedMeetings} consecutive regular meetings of the Board, and fails to submit their apologies to the Chair, Secretary or Deputy Chair, that member will be deemed to have resigned, unless the Board has granted special leave of absence.</p>

<h2>Delegation of Authority</h2>
<p>The Chairperson may, if necessary, delegate Chairmanship of the Board to the Deputy Chairperson or, if he/she is unavailable, to another Trustee.</p>
<p>Beneficiaries, other than Trustees elected at the Annual General Meetings or other Special Meeting, may be co-opted onto the Board (hereinafter referred to as Co-opted Members) for specific projects or to provide specialist advice.</p>
<p>Co-opted Members may only serve for one year at a time, but they may be reappointed at the convenience of the Board.  Such appointments may be made at any time of the year.</p>
<p>Co-opted Members are not eligible to vote at Board meetings.</p>
<p>The Board may delegate to sub-committees, and individuals, as appropriate, authority to act on behalf of the Board from time to time with guidelines determined by the Board.  Such delegations shall be subject to all regulations under the Act and this Charter.</p>

<h2>Constitution for the Marae</h2>
<p>This Charter forms the Constitution for the Marae.</p>
<p>Other rules and regulations may be set out as guidelines for the Marae, depending on their purpose and use.  This may include rules for maintenance, health issues, fees payable for use of Marae facilities, etc.</p>
<p>The Board or ${marae} Marae Committee must ratify any rules and regulations set up by the other body (whichever one is not the body setting up such rules or regulations – i.e. the ${marae} Marae Committee or Board), before the rules or regulations become operational.</p>

<h2>Marae Development Plan</h2>
<p>A Marae Development Plan may be prepared for the Marae, but it will remain a separate document from the Charter. It will be maintained and reviewed by the Marae Trustees and the Marae Committee.  The Marae Development Plan does not need to be registered with the Māori Land Court or any other official body.  The purpose of the Marae Development Plan shall be to enable the Marae to plan future development, based on the history of the Marae and the needs of the Marae and Hapū.</p>

<h2>Marae Committees</h2>
<p>There shall be a Management Committee of the marae, hereinafter referred to as The Marae Committee specifically formed for:</p>
<ul>
  <li>On-going day to day running of the Marae.</li>
</ul>
<p>The Board in consultation with the marae committee may appoint sub-committees as necessary to oversee any aspect of the management of the Marae, particularly pertaining to kawa and tikanga issues.  Such sub-committees may comprise Trustees</p>

<h2>Signatures of ${marae} Marae Trustees</h2>
${sigLines}

<div class="sig-line" style="margin-top:36px">Witnessed by name <span></span></div>
<div class="sig-line">Witness signature <span></span></div>
<div class="sig-line">Witness Occupation <span></span></div>

<p style="margin-top:30px">All in the presence of:</p>
<div class="sig-line">Witness Signature <span></span></div>
<div class="sig-line">Witness Name <span></span></div>
<div class="sig-line">Witness Occupation <span></span></div>

<p style="font-size:11px;color:#999;margin-top:32px">Generated by MaraeHub · maraehub.com · ${new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
</body></html>`;
}

export default function CharterGenerator({ onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleGenerate() {
    const missing = ALL_FIELDS.filter(f => !form[f.key].trim());
    if (missing.length > 0) { setError(`Please fill in: ${missing.map(f => f.label).join(', ')}.`); return; }
    setError('');
    const win = window.open('', '_blank');
    win.document.write(buildCharterHtml(form));
    win.document.close();
    win.print();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div className="modal-title">Fill Out Charter Template</div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: -8, marginBottom: 16 }}>
          Sourced from the official Marae Charter template (Marae Kete / Western Bay of Plenty District Council). Fill in the details below, then Generate to open a print-ready version — use your browser's Print dialog to save it as a PDF.
        </p>

        <FormError message={error} />

        {FIELDS.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label} *</label>
            <input
              className="form-input"
              value={form[f.key]}
              onChange={e => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          </div>
        ))}

        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginTop: 20, marginBottom: 4, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          Governance Settings
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 0, marginBottom: 14 }}>
          Genuine points of variation between marae. Disqualification criteria and core legal structure stay fixed.
        </p>
        {GOVERNANCE_FIELDS.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label} *</label>
            <input
              className="form-input"
              type={f.type || 'text'}
              min={f.type === 'number' ? 0 : undefined}
              max={f.type === 'number' ? 100 : undefined}
              value={form[f.key]}
              onChange={e => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleGenerate} className="btn-primary">Generate</button>
        </div>
      </div>
    </div>
  );
}
