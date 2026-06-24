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
      category: 'Decision Register',
      icon: '📋',
      items: [
        { q: 'What is the Decision Register?', a: 'The Decision Register is a single searchable list of every resolution passed across all of your marae\'s meetings. Instead of opening individual meeting records to find a past decision, you can search by keyword and filter by status — Active, Implemented, or Superseded — to find exactly what you need. The register updates automatically whenever a resolution is recorded in any meeting. There are no extra steps and nothing to set up — if a resolution exists in a meeting, it appears in the Decision Register.' },
        { q: 'How do I filter the Decision Register?', a: 'Go to the Minutes tab and open the Decision Register section. Use the search bar to find resolutions by keyword — the search checks both the resolution number and description. Use the status filter buttons to show only Active resolutions (decisions that are still current), Implemented (decisions that have been carried out), or Superseded (decisions that have been replaced by a later resolution). Select "All" to clear the filter and see every resolution at once.' },
      ]
    },
    {
      category: 'Interest Register',
      icon: '⚖️',
      items: [
        { q: 'What is the Interest Register?', a: 'The Interest Register is a formal record of every conflict of interest declared by trustees. A conflict of interest happens when a trustee has a personal, financial, or family connection to a decision or contract the marae is considering — which means they may not be able to vote or advise on that matter impartially. Recording these declarations is a requirement of good governance practice and expected under New Zealand law, including the principles that apply to charitable trusts and incorporated societies. It shows that your committee is operating transparently and in the best interests of the marae, not individual trustees.' },
        { q: 'When should a trustee declare an interest?', a: 'Declare an interest whenever you have a personal stake in something the committee is deciding. Common examples: a contractor being considered for marae work is your family member, friend, or your own business. A grant application would benefit an organisation you are involved with. A trustee is being paid for services and the committee is setting or reviewing that arrangement. A decision affects land or property you have a personal interest in. The rule of thumb is: if you would benefit — or someone close to you would benefit — from the outcome of a committee decision, declare it. It is always better to declare and step back than to stay silent and have it questioned later.' },
        { q: 'How do I add a declaration to the Interest Register?', a: 'Go to the Minutes tab and open the Interest Register section, then click "+ Add Declaration". Fill in the trustee\'s name, the nature of the interest (what the conflict is and how it relates to the trustee), the date it was declared, and the meeting or decision it relates to. Save the declaration — it will appear in the register straight away with an Active status. Once the matter has been fully resolved or the decision is complete, click "Resolve" to close it. Resolved declarations stay on the register permanently as a record — they do not disappear.' },
        { q: 'Why does declaring an interest matter?', a: 'Declaring an interest protects individual trustees personally. If a decision is ever challenged — by a beneficiary, an auditor, or the Māori Land Court — a properly kept Interest Register shows that your committee followed the right process. It is exactly the kind of record the Māori Land Court looks for when assessing whether a trust has been managed properly. It also protects the marae itself: decisions made without managing conflicts of interest can be overturned or create serious legal exposure. Good governance is not just about making good decisions — it is about being able to show that you made them the right way.' },
        { q: 'What should a trustee do after declaring an interest?', a: 'Once a declaration is made, the trustee with the conflict should step back from discussing and voting on that specific matter. They can leave the room during that part of the meeting if needed. The committee then makes the decision without their involvement. Record in the meeting minutes that the trustee declared an interest and did not participate in the vote. This protects everyone — the trustee, the other trustees, and the marae.' },
      ]
    },
    {
      category: 'Recording a Meeting',
      icon: '📝',
      items: [
        { q: 'How does the meeting page work?', a: 'When you open a meeting in the Minutes tab, everything is on one page — meeting details, minutes, resolutions, and actions. There is no tab switching or separate screens to navigate. Scroll down to move between sections and add to any of them as the meeting progresses. Once you are done, all the information is saved together under that meeting record.' },
        { q: 'Do actions and resolutions connect to other modules automatically?', a: 'Yes — both connect automatically. Any action item you add to a meeting appears straight away on the Task Board, assigned to the person you nominated and showing the due date you set. You do not need to create a separate task. Any resolution you record in a meeting appears straight away in the Decision Register, where it can be searched and filtered across all meetings. Neither connection requires any extra steps — it happens as soon as you save the action or resolution.' },
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
        { q: 'What is the Task Archive?', a: 'When the Completed column contains more than 50 tasks, older completed tasks are automatically moved to a collapsible Archive section below the kanban board. The Completed column always shows the 50 most recent completed tasks. Click "📦 Completed Task Archive" at the bottom of the Tasks tab to expand the archive and view or reopen older tasks.' },
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
        { q: 'What is the Incident Archive?', a: 'Once you have more than 50 resolved incidents, older ones are automatically moved to a collapsible archive below the incident list. Active (unresolved) incidents and the 50 most recent resolved incidents are always shown in the main view. Click "📦 Resolved Incident Archive" to expand and view older records — you can still open any archived incident to view its full details.' },
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
        { q: 'How do I add a goal?', a: 'Go to the Goals tab and click "+ Add Goal". Enter the goal name, description, and category. Set a target date and assign a responsible trustee. Optionally link the goal to related projects, compliance items, or grants — you can select multiple from each category using the chip selector. Progress will update automatically from linked data. Set an initial progress percentage and status, then save.' },
        { q: 'How do I use the Board Report?', a: 'Click the "📊 Board Report" toggle button at the top of the Goals tab to switch to the board report view. This shows all strategic goals in a summary table with a traffic light status indicator, progress percentage, category, status, target date, and responsible trustee — ready for reading out at a board meeting. Click "🎯 Manage Goals" to return to the goals management view.' },
        { q: 'What do the status options mean?', a: 'Not Started — the goal is in the planning phase and work has not begun. In Progress — the committee is actively working toward this goal. At Risk — progress has fallen behind schedule or faces an obstacle. Completed — the goal has been achieved.' },
        { q: 'What do the traffic light colours mean in the Board Report?', a: 'Green (On Track) — the goal is progressing well and the target date is not at risk. Orange (At Risk) — the goal is flagged as at risk, or the target date is within 14 days. Red (Behind Schedule) — the target date has passed and the goal is not yet complete. Grey means the goal has not started and the target date is still in the future.' },
        { q: 'Why does progress update automatically?', a: 'When you link a goal to a project, the project\'s progress percentage is used directly. When linked to a compliance item, the status (Compliant, Due Soon, Overdue) is converted to a progress score. When linked to a grant, the grant\'s stage (Researching through to Approved) is converted to a percentage. This means trustees do not need to manually update every goal — MaraeHub does it for them.' },
        { q: 'Who can see Goals & Reporting?', a: 'Trustees only. The community role cannot access this module. Goals & Reporting exists to keep the committee accountable and give every trustee visibility of progress — without anyone needing to manually chase updates.' },
      ]
    },
    {
      category: 'Workflows',
      icon: '⚙️',
      items: [
        { q: 'What is the Workflows tab?', a: 'Workflows is a step-by-step task engine for managing recurring marae processes. Instead of creating tasks from scratch each time, you pick a pre-built template, give the workflow a name, and click Start — MaraeHub automatically creates all the tasks in the right order and tracks progress for you.' },
        { q: 'Where do I find it?', a: 'Go to the main navigation and click Operations. Workflows is listed in that group alongside Bookings, Calendar, Notices, and Contacts.' },
        { q: 'How do I start a workflow?', a: 'In the Workflows tab, use the dropdown under "Start New Workflow" to pick a template — for example, Tangihanga Preparation or Marae Insurance Renewal. Once a template is selected, a name field will appear. Type a name for this specific run (e.g. "Hēni Smith Tangihanga — July 2026"), then click Start Workflow. All tasks are created immediately and appear in the Active Workflows panel and in the Tasks tab.' },
        { q: 'How many templates are available?', a: 'MaraeHub currently includes 18 built-in templates covering five areas: Governance (trustee meetings, AGM preparation, trustee onboarding), Compliance (insurance renewal, fire safety, WOF review), Maintenance (building inspection, equipment servicing), Operations (tangihanga preparation, contractor vetting, event setup, Facility Hire Agreement), and Funding (grant application, funding report). The most recent addition is the Marae Emergency Readiness Starter Pack, which covers insurance, first aid kit checks, generator testing, water supply inspection, fire safety, and Civil Defence registration. More templates will be added in future releases.' },
        { q: 'How do I track progress?', a: 'The Active Workflows section shows all currently running workflows with a progress bar and the next incomplete task highlighted. As you complete tasks in the Tasks tab, the progress bar updates automatically. When all tasks in a workflow are completed, the workflow is marked as complete and moves out of the Active Workflows view.' },
        { q: 'Do workflow tasks appear in the Task Board?', a: 'Yes. Every task created by a workflow appears in the Tasks tab alongside your other open tasks. Workflow tasks are labelled with the workflow name so you can tell them apart. Complete them from the Task Board as normal — the workflow progress updates automatically each time a step is ticked off.' },
        { q: 'Can I create my own workflow templates?', a: 'Custom templates are planned for a future release. For now, all 15 templates are built in and pre-loaded. If you need a template added, use the Feedback button to request it.' },
        { q: 'Do workflows show where they came from?', a: 'Yes. Every active workflow displays a source record link so you can always trace it back to its origin. For example, a Facility Hire Agreement workflow will show the booking it was started from, and a maintenance workflow started from an asset service reminder will link back to that asset. Click the link on the workflow card to jump straight to the source record.' },
        { q: 'How do workflow tasks appear on the Task Board?', a: 'Workflow tasks use a parent and subtask structure to keep the Task Board tidy. Each workflow appears as a single parent task card on the board — the workflow name and overall progress are shown on that card. The individual steps inside the workflow appear as subtasks underneath, expandable from the card. This means a 10-step workflow takes up one card on the board instead of ten, so the board stays readable no matter how many workflows are running.' },
        { q: 'Can I edit or reorder steps in a workflow template?', a: 'Yes. Go to the Workflows tab and click "Manage Templates". From there you can open any template and reorder its steps by dragging them up or down, edit the name or description of any step, add a new step at any point in the sequence, or delete a step you do not need. Changes to a template apply to future workflows started from that template — they do not affect workflows already in progress.' },
      ]
    },
    {
      category: 'Smart Suggestions',
      icon: '💡',
      items: [
        { q: 'What are Smart Suggestions?', a: 'Smart Suggestions are prompts that appear automatically when MaraeHub detects that a workflow might be relevant to something happening on your marae. Instead of having to remember to start a workflow yourself, the system notices a trigger — like a service reminder becoming due, a booking being approved, or a trustee flagging a booking as commercial or external hire — and offers to start the matching workflow for you. The Facility Hire Agreement workflow is one example that can be triggered this way.' },
        { q: 'When does a service reminder suggest a workflow?', a: 'When an asset service reminder becomes due, MaraeHub checks whether a matching workflow template exists. If one is found — for example, a Heat Pump Service reminder triggers the Heat Pump Service template, or a Building Maintenance and Repair reminder triggers the matching maintenance workflow — a suggestion will appear prompting you to start that workflow. You can accept the suggestion to launch the workflow immediately, or dismiss it if you want to handle it another way.' },
        { q: 'How does the Facility Hire Agreement workflow get triggered?', a: 'When a trustee approves a booking, they are given the option to flag it as a commercial hire or external hire. If that flag is set, MaraeHub automatically suggests starting the Facility Hire Agreement workflow for that booking. The workflow is pre-linked to the booking so all the relevant details are carried through. This ensures the right paperwork and sign-off process is followed every time the marae is hired out for external or commercial purposes.' },
      ]
    },
    {
      category: 'Automatic Workflows',
      icon: '🤖',
      items: [
        { q: 'What are Automatic Workflows?', a: 'Automatic Workflows are workflows that MaraeHub starts on its own — without any trustee needing to click anything. When an asset service reminder falls within 14 days of its due date and no active workflow already exists for that reminder, the system checks whether a matching workflow template exists and starts it automatically. The workflow and all of its tasks appear in the Workflows tab and Task Board straight away.' },
        { q: 'How does the system know which workflow to start?', a: 'MaraeHub matches the name of the service reminder to the most relevant workflow template. For example, a reminder called "Heat Pump Service" automatically triggers the Heat Pump Service workflow template. The match is based on the reminder type — so the more specific and consistent your reminder names are, the better the system can find the right template. If no close match exists, no workflow is started and the reminder continues to show as normal.' },
        { q: 'Can I turn off Automatic Workflows for a specific reminder?', a: 'Yes. If you want to manage a particular service reminder manually — starting workflows yourself rather than having them start automatically — go to the Assets tab, find the asset, and open its reminders. Click "Edit" on the reminder you want to change, and toggle off "Auto-start workflow". With this turned off, the reminder will still appear and send early warnings as usual, but no workflow will be started automatically when it falls due.' },
        { q: 'Where will I see an automatic workflow once it has started?', a: 'An automatic workflow appears in exactly the same place as one you start manually. You will see it in the Active Workflows section of the Workflows tab, with a progress bar and the first incomplete task highlighted. All of its tasks also appear on the Task Board, labelled with the workflow name. A note on the workflow card shows it was started automatically from the service reminder, so you can always trace it back to its origin.' },
      ]
    },
    {
      category: 'Board View Insights',
      icon: '📈',
      items: [
        { q: 'What is the Workflow Activity panel in Board View?', a: 'Board View includes a Workflow Activity section that gives trustees a quick read on how workflows are tracking across the marae. It shows the number of currently active workflows and how many workflows were completed this month — useful for seeing whether your committee is keeping on top of recurring processes without having to open the Workflows tab.' },
        { q: 'What alerts appear in the Workflow Activity section?', a: 'Two types of alerts appear automatically. If a workflow has had no progress in 14 or more days — meaning none of its tasks have been completed — Board View will flag it as stalled so a trustee can follow up. If a booking income record has been created automatically but the hire fee has not yet been entered (it still shows as $0), an alert will appear reminding trustees to open that Finance record and enter the agreed amount. Both alerts clear automatically once the issue is resolved.' },
      ]
    },
    {
      category: 'Finance Manager',
      icon: '📊',
      items: [
        { q: 'How do I record income?', a: 'Go to the Finance tab and click the "Income" section, then "+ Add Income". Enter the date, description, amount, category (e.g. Grants & Funding, Hire Income, Donations), and status (Confirmed or Pending). Save — the income appears in the table and updates the FY Summary totals at the top.' },
        { q: 'How do I record an expense?', a: 'Go to the Finance tab and click the "Expenses" section, then "+ Add Expense". Enter the date, description, amount, category, payee, and reference number. You can upload a receipt for record-keeping. The payee field now searches your Contacts list — start typing a name to see suggestions, or type a new name if the payee is not in your contacts.' },
        { q: 'How does the Payee field work?', a: 'When adding an expense, the Payee field searches your Contacts list automatically as you type. Click a suggestion to use that contact\'s name, or type a new name freely if the payee is not in your contacts. This keeps expense records consistent with your existing contacts and makes reconciliation easier.' },
        { q: 'What is the Balance Sheet?', a: 'The Balance Sheet section gives you a point-in-time snapshot of your marae\'s financial position — total assets minus total liabilities equals net worth. Cash and bank balances, loans, and outstanding payments are entered manually. Equipment value is pulled automatically from the Assets Register. The balance sheet is saved separately from income and expense records.' },
        { q: 'What are the Investments fields on the Balance Sheet?', a: 'The Balance Sheet Assets section includes four investment fields: Term Deposits, Shares & Bonds, Property Investments, and Other Investments. Enter the current value of each. You can add a notes field to describe specific investments (e.g. ANZ term deposit, Māori Authority shares). All investment values are included in the Total Assets calculation and appear in the AGM Report.' },
        { q: 'How do I set a budget?', a: 'Go to the Finance tab and click the "Budget" section. For each expense category, enter the budgeted amount for the current financial year. MaraeHub compares actual spend against these budgets in real time — categories over budget show as red in the expense table and trigger an amber alert in the Board View.' },
        { q: 'What does the AGM Report include?', a: 'The AGM Report is a print-ready financial summary for your Annual General Meeting. Go to Finance > Reports and click "Generate AGM Report". It includes a full income breakdown, expense vs budget comparison, and the Balance Sheet snapshot including investments, loans, and net worth. You can print it or save as PDF.' },
      ]
    },
    {
      category: 'Finance Automation',
      icon: '⚡',
      items: [
        { q: 'Does Finance update automatically when a booking is approved?', a: 'Yes. When a trustee approves a booking, MaraeHub automatically creates a placeholder income record in the Finance tab under the Hire Income category. The amount is set to $0 because the actual hire fee may not be confirmed yet — a trustee just needs to open that record and enter the correct amount once it is agreed. This means the booking is always reflected in Finance straight away, without anyone needing to remember to add it manually.' },
        { q: 'Does Finance update automatically when a grant is approved?', a: 'Yes. When a grant is marked as Approved in the Grants tab, MaraeHub automatically creates a confirmed income record in Finance for the full grant amount. Because the amount is already recorded in the grant, no manual entry is needed — the income record is created with the correct figure, funder name, and category automatically.' },
        { q: 'What happens to the Finance record if a booking is declined or cancelled?', a: 'If a booking that already has a placeholder income record is later declined or cancelled, MaraeHub automatically removes that placeholder from Finance. You do not need to go in and delete it manually. This keeps your income records accurate and prevents incomplete placeholder entries from appearing in your financial reports.' },
        { q: 'Why does the booking income record show $0?', a: 'The $0 placeholder is created at the point of approval so the booking is immediately reflected in Finance — but the exact hire fee is often not confirmed until after the committee has spoken to the hirer. Open the income record in the Finance tab, enter the agreed hire fee, and save. The FY Summary totals will update straight away.' },
      ]
    },
    {
      category: 'Emergency Preparedness',
      icon: '🆘',
      items: [
        { q: 'Why does Emergency Preparedness have its own section?', a: 'Marae are recognised welfare centres under the New Zealand Civil Defence and Emergency Management Act 2002. Your marae may be called upon to house whānau during a flood, earthquake, or storm — often with little warning. Emergency Preparedness is treated separately because it carries the highest community risk if neglected. The tracker highlights these items in deep red to ensure they are never overlooked.' },
        { q: 'What items are automatically set up for me?', a: 'MaraeHub pre-loads ten standard emergency preparedness items when you first open the Compliance tab: Civil Defence Emergency Plan, emergency contact list, generator check, water supply inspection, food and supply kit, community welfare register, first aid kit, evacuation routes, emergency communications plan, and a structural storm-readiness check. These reflect standard Civil Defence guidance for marae welfare centres.' },
        { q: 'How do I mark an item as done?', a: 'Open the Compliance tab, find the Emergency Preparedness item, and click the "✓ Done" button on the right. If the item has a renewal schedule (e.g. every 3 or 6 months), MaraeHub will automatically set the next due date forward by that interval. The item moves from Overdue or Due Soon to Compliant immediately.' },
        { q: 'Does it create a task automatically?', a: 'Yes. If an Emergency Preparedness item is overdue, MaraeHub automatically creates a High-priority task in the Task Board — prefixed with "OVERDUE:" — so it appears alongside all other open work for your committee. When a trustee marks the compliance item as done from the Compliance tab, or completes the task from the Task Board, both records are updated automatically.' },
        { q: 'How often should each item be reviewed?', a: 'Renewal periods vary by item: the Civil Defence Emergency Plan and community welfare register should be reviewed annually. Emergency contact lists, water supply, food kits, and first aid kits every 6 months. The generator should be tested quarterly. MaraeHub tracks these cycles for you — once you record a completion date, the next due date is set automatically.' },
        { q: 'Where does it show in the Board View?', a: 'Any overdue or unscheduled Emergency Preparedness item appears as a red alert at the very top of the Board View — above all other alerts — because it is treated as the highest-risk category. The Smart Insights panel also surfaces a specific message about Civil Defence readiness so it is visible at every board meeting.' },
      ]
    },
    {
      category: 'How the Task Board Works',
      icon: '🔄',
      items: [
        { q: 'What is the closed loop system?', a: 'The Task Board is connected to every other module in MaraeHub. When something is approaching its deadline or goes overdue — a compliance item, a project due date, a service reminder, a meeting action, a strategic goal, or a grant deadline — MaraeHub automatically creates a task in the Task Board. This means upcoming and overdue items from across the whole platform surface in one place, so nothing falls through the cracks.' },
        { q: 'Which modules create tasks automatically?', a: 'Six modules feed into the Task Board automatically: Compliance Tracker, Projects, Assets, Minutes, Goals, and Grants. Each module checks for upcoming and overdue items whenever you visit that tab and creates tasks if they do not already exist. Compliance and Assets create tasks 30 days before a due date. Goals create tasks 14 days before a target date. Projects create tasks 7 days before a project due date. Meeting Actions and Grants already trigger before the deadline by default.' },
        { q: 'What is the early warning system?', a: 'Before an item goes overdue, MaraeHub creates an UPCOMING task as an early warning. These are Medium priority and appear with an orange border in the Task Board. Compliance items and asset service reminders get an UPCOMING task 30 days before their due date. Strategic goals get one 14 days before the target date. Projects get one 7 days before the project due date. This gives trustees time to act before the deadline is missed.' },
        { q: 'What happens when I complete an UPCOMING task?', a: 'Completing an UPCOMING task tells MaraeHub you are aware of the approaching deadline. For compliance items, it records today as the last reviewed date. For other modules, the completion is the acknowledgment. Importantly, the actual due date does not advance — the item is still due on the original date. If the deadline passes without the item being renewed or updated, the UPCOMING task is automatically replaced by a red High-priority OVERDUE task.' },
        { q: 'What happens when I complete an OVERDUE task?', a: 'Completing an OVERDUE task feeds back to the source module and resets it. Completing a compliance OVERDUE task marks the item as done and advances its next due date by the renewal interval. Completing a service reminder OVERDUE task advances the reminder date by its recurrence interval. Completing a meeting action OVERDUE task marks that action as Completed in the Minutes tab. Completing a project OVERDUE task moves the project to Review status. Completing a goal OVERDUE task moves the goal to In Progress.' },
        { q: 'What do the task title prefixes mean?', a: '"UPCOMING:" means a deadline is approaching but has not yet passed — orange, Medium priority, and an early warning to act now. "OVERDUE:" means a compliance item is past its due date — red, High priority. "PROJECT:" means a project deadline has been missed. "SERVICE:" means an asset service reminder is overdue. "ACTION:" means a meeting action is overdue. "GOAL:" means a strategic goal is behind schedule. "GRANT:" means a grant deadline is within 14 days. These prefixes tell the system which record to update when you complete the task.' },
        { q: 'How do I move a task through the board?', a: 'Each task card has ← and → arrow buttons. Click → to move a task from Open → In Progress → Completed → Cancelled. You can also click the status pill in the centre of the card and choose any status directly. Tasks moved to Completed are time-stamped and the "Completed Today" tile on the Task Board updates instantly.' },
        { q: 'Can I also create tasks manually?', a: 'Yes. Click "+ Add Task" in the Task Board to create any task you like. Manual tasks are not linked to a source module — completing them does not update any other record. They are useful for one-off trustee to-dos that do not fit an existing module.' },
        { q: 'Where can I see all open tasks across modules?', a: 'The Board View has an "Open Tasks — by Source" section that groups all active tasks by their origin module, including a separate Upcoming group for early warning tasks. Each group shows the task titles and due dates, and links directly to the Task Board. The Board View alert strip also shows amber warnings for upcoming deadlines and red alerts for overdue items — these are kept separate so trustees can see at a glance what needs urgent action versus what just needs preparation.' },
      ]
    },
    {
      category: 'Finding Your Way Around',
      icon: '🗺️',
      items: [
        { q: 'How is the navigation organised?', a: 'The navigation is grouped into five sections. The Dashboard is your starting point — a summary of recent bookings, active projects, and community feedback. Governance covers the Board View, Minutes, and Goals. Operations covers Bookings, Calendar, Notices, Contacts, and Workflows. Assets & Compliance covers the Assets register and Compliance Tracker. Funding & Projects covers Grants, Projects, and the Task Board. Admin covers Documents and Settings.' },
        { q: 'What is the Board View?', a: 'Board View is a single-screen summary designed for trustee meetings. It shows red and amber alerts for anything urgent, Smart Insights with recommended actions, KPI tiles for bookings and ratings, strategic goals progress, compliance status, upcoming bookings, active projects, open meeting actions, the grants pipeline, asset service reminders, and all open tasks grouped by source. You can print it directly from the browser using the Print button.' },
        { q: 'What is the Dashboard?', a: 'The Dashboard is your personal landing page when you log in. It shows a quick count of pending bookings, active projects, and assets, a list of recent booking requests you can click through to, a progress view of active projects, and a summary of community feedback ratings. Click any stat tile to jump straight to that module.' },
        { q: 'What does the Goals tab do?', a: 'Goals & Reporting lets your committee set strategic goals and track them automatically using data from other modules. Link a goal to a project, compliance item, or grant and the progress percentage updates without any manual entry. Goals appear in the Board View with a traffic light — green for on track, orange for at risk, red for behind schedule.' },
        { q: 'What is the Notices tab?', a: 'The Noticeboard is where trustees post announcements for the whole community. Community members can read notices when they log in but cannot edit them. Categories include General, Urgent, Event, and Maintenance. Use Urgent for anything requiring immediate action or awareness.' },
        { q: 'Can community members see all of this?', a: 'No. Community members see a simplified portal with three sections: Book the Marae (3-step booking wizard), My Bookings (their booking history and feedback), and the Calendar and Noticeboard. All governance modules — Compliance, Goals, Board View, Minutes, Tasks, Assets, Grants, Projects, Contacts, Documents — are trustee-only.' },
      ]
    },
    {
      category: 'Status Colours',
      icon: '🟢',
      items: [
        { q: 'What do the green, orange, red, and grey colours mean?', a: 'Across MaraeHub, status colours follow a consistent traffic-light system. Green means everything is current and no action is needed. Orange means something is approaching a deadline or needs attention soon. Red means something is overdue or has missed a deadline and requires immediate action. Grey means an item has not been started or has no due date set yet.' },
        { q: 'What does green mean in each module?', a: 'Compliance: item is up to date with no upcoming deadline within 30 days. Goals: goal is on track with the target date still safely ahead. Booking: booking has been approved. Task: task is in the Completed column. Asset: no overdue service reminders. Grant: grant has been approved.' },
        { q: 'What does orange mean in each module?', a: 'Compliance: item is due within 30 days — schedule a renewal soon. Goals: goal is flagged as At Risk, or the target date is within 14 days. Booking: booking is pending and awaiting committee review. Task: task is In Progress. Grant: deadline is within 14 days and the application is still active. Alert strip: amber alerts in Board View are warnings that need attention but are not yet overdue.' },
        { q: 'What does red mean in each module?', a: 'Compliance: item is past its due date and requires immediate action. Goals: goal is behind schedule — the target date has passed and it is not complete. Task: task is flagged as Overdue — it has a due date that has passed. Booking: booking has been declined. Alert strip: red alerts in Board View require action before the next meeting. Emergency Preparedness items that are overdue or unscheduled always appear in deep red at the very top of the Board View.' },
        { q: 'What does grey mean?', a: 'Grey means an item exists but has no due date set, or work has not yet started. In Goals, a grey traffic light means the goal is Not Started and the target date is still in the future. In Compliance, grey (Not Set) means no due date has been recorded for that item yet — you should add one. Grey is not an emergency but it is a gap worth filling.' },
        { q: 'Where do the priority colours on Task cards come from?', a: 'Task cards have a coloured left border based on their priority. A red left border means High priority. An amber left border means Medium priority. A green left border means Low priority. This is separate from the status colour — a Low-priority task can still be overdue (shown with a red OVERDUE badge and red date text).' },
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
      category: 'Trustee Permissions',
      icon: '🔑',
      items: [
        { q: 'What are the two trustee permission levels?', a: 'There are two levels: Standard Trustee and Admin Trustee. Standard Trustees can view and edit all modules but have restricted access to certain actions. Admin Trustees have full access to everything on the platform.' },
        { q: 'Which modules can every trustee access, regardless of permission level?', a: 'Every trustee — Standard or Admin — has full access to Assets, Compliance, Tasks, Workflows, Goals, Grants, Projects, Documents, Contacts, Minutes, Calendar, and the Noticeboard. In all of these modules, every trustee can view, create, and edit records. Permission level does not affect access to any of these areas.' },
        { q: 'What can only Admin trustees do?', a: 'Admin trustees have three areas of exclusive access that Standard trustees cannot use. Finance — Standard trustees cannot view the Finance module at all. If they navigate to it, they will see a locked screen explaining that Finance is restricted to Admin trustees. Booking approval — only Admin trustees can approve, decline, or delete bookings. Standard trustees can view booking requests but cannot take action on them. Trustee management — only Admin trustees can invite new trustees to the platform or change anyone\'s permission level in Settings.' },
        { q: 'I\'m a Standard trustee and I need to do something only an Admin can do. What should I do?', a: 'Ask one of your marae\'s Admin trustees for help. Admin trustees can approve bookings, access the Finance module, and manage trustee permissions on your behalf. If you are not sure who the Admin trustees are, check with whoever set up your marae\'s MaraeHub account.' },
        { q: 'What can a Standard Trustee do?', a: 'Standard Trustees can view and edit all modules — Bookings, Minutes, Projects, Assets, Compliance, Goals, Grants, Tasks, Contacts, Documents, and Notices. They cannot approve or decline bookings, access the Finance module, or change trustee permission levels. If they click on Finance they will see a locked screen with instructions to contact their Admin Trustee.' },
        { q: 'What can an Admin Trustee do?', a: 'Admin Trustees have full access to everything. They can approve and decline bookings, access the Finance module, manage other trustees\' permission levels (upgrading Standard to Admin or downgrading Admin to Standard), and invite new trustees by email directly from Settings.' },
        { q: 'How do I know what my permission level is?', a: 'Admin Trustees can see a "Trustee Permissions" section at the bottom of the Settings tab. If you open Settings and do not see that section, you are a Standard Trustee. You can also check with your Admin Trustee to confirm your level.' },
        { q: 'How do I invite a new trustee?', a: 'Go to Settings → Trustee Permissions (Admin Trustees only). At the top of that section there is an email input field. Enter the new trustee\'s email address and click "✉ Invite Trustee". MaraeHub will send them a magic link by email — they click the link and land directly on the Trustee Dashboard, ready to use the platform. No passwords to set, no Supabase dashboard needed.' },
        { q: 'How do I change a trustee\'s permission level?', a: 'Go to Settings → Trustee Permissions (Admin Trustees only). Each trustee in the list has two buttons — "Standard" and "Admin". The highlighted button shows their current level. Click the other button to change them. For example, if a trustee is currently Standard and you click "Admin", they immediately get full access. The change takes effect the next time they navigate to a new page or refresh.' },
        { q: 'Can an Admin Trustee demote themselves?', a: 'Only if there is at least one other Admin Trustee on the platform. If you are the only Admin, MaraeHub will block the demotion and show a message asking you to promote another trustee first. This prevents the platform from being left with no Admin Trustee.' },
        { q: 'What happens when a new trustee accepts an invite?', a: 'When an invited trustee clicks the magic link in their email, they are taken directly to the MaraeHub Trustee Dashboard. Their account is pre-set as a Standard Trustee. An Admin Trustee can then go to Settings → Trustee Permissions to upgrade them to Admin if needed.' },
        { q: 'Who is automatically set as Admin Trustee?', a: 'The first trustee account created for a marae is automatically set as Admin Trustee. All subsequent trustees start as Standard Trustees and can be upgraded by any existing Admin.' },
      ]
    },
    {
      category: 'Settings',
      icon: '⚙️',
      items: [
        { q: 'How do I change the marae name?', a: 'Go to the Settings tab. You can update the marae name, location, iwi, hapū, and contact details. Click "Save Settings" and the name will update across the whole platform immediately.' },
      ]
    },
    {
      category: 'Email Notifications',
      icon: '📧',
      items: [
        { q: 'What are email notifications?', a: 'Email notifications are automatic emails sent to trustees every morning at 8am when something on the marae needs their attention. Instead of having to log in and check each module, MaraeHub sends a summary directly to your inbox so nothing slips through the cracks. You only receive an email on days when there is actually something to act on — there is no daily email if everything is up to date.' },
        { q: 'What triggers an email notification?', a: 'Five types of items trigger notifications. Compliance items due within 30 days — so you have time to renew before the deadline. Bookings starting within 48 hours — a heads-up before the marae is due to be used. Grant deadlines within 14 days — an early reminder to submit or finalise applications in time. Meeting actions that are overdue by 7 or more days — flagging tasks that have been assigned but not yet completed. Goals marked as At Risk or Completed — so the full committee stays across strategic progress without needing to open the Goals tab.' },
        { q: 'How do I turn email notifications on or off?', a: 'Go to Settings and open the "Email Notifications" section. Each notification type has its own toggle — you can turn individual types on or off independently. For example, you might keep compliance and grant reminders on but turn off booking notifications if another trustee handles approvals. Changes take effect immediately and apply only to your account — each trustee controls their own notification preferences.' },
        { q: 'Will I get the same email about the same item every day?', a: 'No. MaraeHub tracks what has already been sent and will not email you about the same item more than once every 25 days. If a compliance item is still due in 30 days and has not been updated, you will receive one notification about it — and then not again for another 25 days. This prevents your inbox from filling up with repeated reminders about the same unresolved issue.' },
      ]
    },
    {
      category: 'Privacy & Data',
      icon: '🔒',
      items: [
        { q: 'Where can I find information about how our marae data is protected?', a: 'Go to Settings and open the "Privacy & Data" section. This page gives a full plain-language explanation of how MaraeHub handles your marae\'s information — covering data ownership, your rights under the Privacy Act 2020, and what happens to your data if you ever leave the platform.' },
        { q: 'Who owns our marae\'s data?', a: 'Your marae owns its data. MaraeHub stores it securely on your behalf — but it belongs to you, not to us. The Privacy & Data page in Settings explains exactly what information is stored, how it is protected, and what rights your committee has over it.' },
        { q: 'What does the Privacy Act 2020 mean for our marae?', a: 'New Zealand\'s Privacy Act 2020 governs how personal information must be collected, stored, and used. The Privacy & Data page in Settings explains how MaraeHub complies with the Act and what this means in practice for trustees and community members whose information is held on the platform.' },
        { q: 'What happens to our data if we leave MaraeHub?', a: 'If your marae ever decides to leave MaraeHub, your data does not disappear or get retained without your consent. The Privacy & Data page in Settings explains the full process — including how to request an export of your records and what happens to stored data after an account is closed.' },
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
                  <div>No results found — try a different search term</div>
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
