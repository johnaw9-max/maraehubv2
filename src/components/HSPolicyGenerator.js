import React, { useState } from 'react';
import FormError from './FormError';

// Master template sourced directly from the real Ngāti Whātua Ōrākei
// Trustee Limited Health and Safety Policy (July 2021), read and
// converted 14 August 2026. Legislative references (HSWA 2015 and both
// 2016 Regulations), the Policy Statement (section 3), and the 4
// mātāpono values in section 2.2 (kupu Māori + English translations)
// are kept verbatim as real, credible content -- only the organisation
// name and adoption date are genuine points of variation. Three
// deliberate generalisations beyond pure substitution, confirmed before
// building: "board of directors" -> "Board of Trustees" and dropping
// the "Trustee Limited" suffix (matches this app's own Charter tool,
// which models a typical marae reservation Board of Trustees, not a
// registered company), and section 4's Trust Deed reference ->
// "[Name] Charter" for consistency with that same sibling tool.

const FIELDS = [
  { key: 'org_name',      label: 'Organisation / Marae Name', placeholder: 'e.g. Aroha Marae' },
  { key: 'adoption_date', label: 'Policy Adoption Date',       type: 'date' },
];

// Display text (used in section 6.1) is kept deliberately separate from the
// year-offset used to calculate "Date of next review" -- a free-text cycle
// like "every three years" can't safely drive date math via string-parsing.
const REVIEW_CYCLE_PRESETS = [
  { value: 'annually',   label: 'annually',   years: 1 },
  { value: 'biennially', label: 'biennially', years: 2 },
  { value: 'custom',     label: 'Custom...',  years: null },
];

const EMPTY_FORM = {
  ...FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {}),
  review_cycle: 'biennially',
  review_cycle_custom_label: '',
  review_cycle_custom_years: '',
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatFullDate(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatMonthYear(dateStr) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
}

function reviewMonthYear(dateStr, years) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setFullYear(d.getFullYear() + years);
  return d.toLocaleDateString('en-NZ', { month: 'long', year: 'numeric' });
}

function buildHSPolicyHtml(f) {
  const org            = escapeHtml(f.org_name.trim());
  const adoptionFull    = formatFullDate(f.adoption_date);
  const adoptionMonthYr = formatMonthYear(f.adoption_date);

  const isCustomCycle = f.review_cycle === 'custom';
  const cycleLabel = isCustomCycle
    ? escapeHtml(f.review_cycle_custom_label.trim())
    : REVIEW_CYCLE_PRESETS.find(p => p.value === f.review_cycle).label;
  const cycleYears = isCustomCycle
    ? Number(f.review_cycle_custom_years)
    : REVIEW_CYCLE_PRESETS.find(p => p.value === f.review_cycle).years;
  const reviewMonthYr = reviewMonthYear(f.adoption_date, cycleYears);

  return `<!DOCTYPE html><html><head><title>Health and Safety Policy — ${org}</title>
<style>
body{font-family:Georgia,serif;max-width:840px;margin:40px auto;color:#222;line-height:1.7}
h1{font-size:24px;text-align:center;border-bottom:2px solid #1a4a3a;padding-bottom:8px}
h1 .sub{display:block;font-size:15px;font-weight:normal;margin-top:6px}
h2{font-size:16px;margin-top:26px;color:#1a4a3a}
p{font-size:13px;margin:10px 0}
ul{font-size:13px;padding-left:22px}
table.meta{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
table.meta td{padding:4px 0;vertical-align:top}
table.meta td.label{font-weight:bold;width:140px}
table.def{width:100%;border-collapse:collapse;margin:8px 0;font-size:13px}
table.def td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}
table.def td.term{font-weight:bold;width:220px}
</style></head><body>

<h1>Health and Safety Policy<span class="sub">${org}</span></h1>

<table class="meta">
  <tr><td class="label">Description:</td><td>Health and Safety Policy of the ${org}</td></tr>
  <tr><td class="label">Approved by:</td><td>Board Resolution</td></tr>
  <tr><td class="label">Date:</td><td>${adoptionFull}</td></tr>
</table>

<h2>1 Purpose and Scope</h2>
<p>1.1 This policy describes the commitment of ${org} ("we" "us" and "our") to ensure the health and safety of people who work for us and people we work with, including our trustees, staff, contractors, volunteers, and manuhiri ("you" and "your").</p>

<h2>2 Interpretation and Application</h2>
<p>2.1 This policy is the overarching document of our Health and Safety Management System and must be read in conjunction with our other policies, procedures, standard operating procedures, guidance, and standards.</p>
<p>2.2 The mātāpono of ${org} are the values that guide our actions and ground us in tikanga Māori. This policy will be interpreted and applied in accordance with the mātāpono of ${org}, with particular emphasis on the following:</p>
<ul>
  <li>a) Rangatiratanga – kia whakatinana i ngā āhuatanga tika o te rangatiratanga puta noa te hapū<br><em>Leadership – to live and practice positive leadership throughout the hapū</em></li>
  <li>b) Manaakitanga – ko te whānau kei te pokapū o ngā kaupapa manaaki a te poari. Whai muri, kia rongo ngā hau e whā i te kakara o te manaaki o ${org}<br><em>Care and host responsibility - whānau are the core focus of hapū development. Our host responsibility to others will positively reflect our role as tangata whenua.</em></li>
  <li>c) Kotahitanga – kia kotahi te tū kia kotahi te hoe<br><em>Unity - stand as one and work together</em></li>
  <li>d) Kaitiakitanga – kia tiakina ō tātou whānau, o tatou whenua, ā tatou taonga me ā tatou rawa mō āke tonu atu<br><em>Guardianship – to protect our people, our lands, our resources and our taonga forever</em></li>
</ul>

<h2>3 Policy Statement</h2>
<p>3.1 Our goal is to eliminate injuries, incidents, and cases of occupational illness/ill health by ensuring that you, the people we work with, and our manuhiri are physically, mentally, and Culturally Safe at our workplaces and while conducting work for us.</p>
<p>3.2 Through our Health and Safety Management System, we ensure that:</p>
<ul>
  <li>3.2.1 Hazards are identified and eliminated where reasonably practicable;</li>
  <li>3.2.2 Risks are evaluated, reduced and controlled;</li>
  <li>3.2.3 Incidents and occupational illnesses are prevented, or otherwise investigated;</li>
  <li>3.2.4 Our health and safety objectives are set, achieved, and performance monitored;</li>
  <li>3.2.5 Our staff are consulted and have every opportunity for engagement and participation; and</li>
  <li>3.2.6 We comply with or exceed legislative and other applicable requirements.</li>
</ul>
<p>3.3 We strive to achieve continuous improvement within our health and safety system, and this is driven by our Board, management and health and safety committees.</p>
<p>3.4 We expect you to share our commitment to health and safety by communicating with us, openly voicing your concerns, adhering to our requirements, and working with us to achieve our collective goal to keep people safe. This includes correcting (if it is safe to do so) and reporting hazards, reporting incidents and occupational health concerns (regarding physical health, mental health and wellbeing, and Cultural Safety), and bringing any health and safety matters or suggestions to our attention.</p>
<p>3.5 If you have anything to report, please let your manager, host and/or your Health and Safety Representative know immediately. Hazards and incident reports can and should also be made using our systems.</p>
<p>3.6 Your participation and commitment to keeping people safe is much appreciated.</p>

<h2>4 Relevant Legislation and Authoritative Guidance</h2>
<p>4.1 Everyone performing a function under this policy is required to comply with all applicable legislation (and any successor legislation) and authoritative guidance, including but not limited to:</p>
<ul>
  <li>Health and Safety at Work Act 2015</li>
  <li>Health and Safety at Work (General Workplace and Risk Management) Regulations 2016</li>
  <li>Health and Safety at Work (Worker Engagement, Participation, and Representation) Regulations 2016</li>
  <li>${org} Charter</li>
</ul>

<h2>5 Definitions</h2>
<p>5.1 The following definitions apply to this policy:</p>
<table class="def">
  <tr><td class="term">Board</td><td>means the board of Trustees of ${org}</td></tr>
  <tr><td class="term">Culturally Safe and Cultural Safety</td><td>means consistent with tikanga Māori and respectful of all cultures within the workplace</td></tr>
  <tr><td class="term">Health and Safety Management System</td><td>means our health and safety management system which gives effect to our commitments in this policy and is more fully described in our Health and Safety Manual</td></tr>
  <tr><td class="term">Health and Safety Representative</td><td>means the appointed or elected representative of workers responsible for advancing health and safety matters</td></tr>
</table>

<h2>6 Policy Review</h2>
<p>6.1 This policy is to be reviewed ${cycleLabel}, with any changes to be approved by the Board.</p>
<p>6.2 Date of next review: <strong>${reviewMonthYr}</strong></p>

<p style="font-size:11px;color:#999;margin-top:32px">Generated by MaraeHub · maraehub.com · Adopted ${adoptionMonthYr}</p>
</body></html>`;
}

export default function HSPolicyGenerator({ onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  function setField(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleGenerate() {
    const missing = FIELDS.filter(f => !form[f.key].trim());
    if (missing.length > 0) { setError(`Please fill in: ${missing.map(f => f.label).join(', ')}.`); return; }
    if (form.review_cycle === 'custom') {
      if (!form.review_cycle_custom_label.trim()) { setError('Please fill in: Custom Review Cycle Label.'); return; }
      if (!form.review_cycle_custom_years.trim() || Number(form.review_cycle_custom_years) <= 0) {
        setError('Please enter a valid number of years for the custom review cycle.'); return;
      }
    }
    setError('');
    const win = window.open('', '_blank');
    win.document.write(buildHSPolicyHtml(form));
    win.document.close();
    win.print();
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-title">Fill Out Health &amp; Safety Policy</div>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: -8, marginBottom: 16 }}>
          Based on Ngāti Whātua Ōrākei's real, board-approved Health and Safety Policy. Fill in the details below, then Generate to open a print-ready version — use your browser's Print dialog to save it as a PDF.
        </p>

        <FormError message={error} />

        {FIELDS.map(f => (
          <div className="form-group" key={f.key}>
            <label className="form-label">{f.label} *</label>
            <input
              className="form-input"
              type={f.type || 'text'}
              value={form[f.key]}
              onChange={e => setField(f.key, e.target.value)}
              placeholder={f.placeholder}
            />
          </div>
        ))}

        <div className="form-group">
          <label className="form-label">Review Cycle *</label>
          <select
            className="form-input"
            value={form.review_cycle}
            onChange={e => setField('review_cycle', e.target.value)}
          >
            {REVIEW_CYCLE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        {form.review_cycle === 'custom' && (
          <>
            <div className="form-group">
              <label className="form-label">Custom Review Cycle Label *</label>
              <input
                className="form-input"
                value={form.review_cycle_custom_label}
                onChange={e => setField('review_cycle_custom_label', e.target.value)}
                placeholder="e.g. every three years"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Years Until Next Review *</label>
              <input
                className="form-input"
                type="number"
                min="1"
                value={form.review_cycle_custom_years}
                onChange={e => setField('review_cycle_custom_years', e.target.value)}
                placeholder="e.g. 3"
              />
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleGenerate} className="btn-primary">Generate</button>
        </div>
      </div>
    </div>
  );
}
