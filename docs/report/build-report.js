// Builds the OB project report in the style of the group's proposal: A4, Times New Roman 12 pt,
// double spacing, justified body, page numbers top right.
const fs = require('fs')
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, Header, PageNumber, Table, TableRow, TableCell,
  WidthType, BorderStyle, ShadingType, LineRuleType, PageBreak, VerticalAlign,
} = require('docx')

const FONT = 'Times New Roman'
const DOUBLE = { line: 480, lineRule: LineRuleType.AUTO }
const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size ?? 24, bold: o.bold, italics: o.italics, characterSpacing: o.spacing })

/** Body paragraph: justified, double spaced, first-line indent; **bold** and *italic* inline marks. */
function P(text, o = {}) {
  const parts = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(run(text.slice(last, m.index)))
    const t = m[0]
    parts.push(t.startsWith('**') ? run(t.slice(2, -2), { bold: true }) : run(t.slice(1, -1), { italics: true }))
    last = m.index + t.length
  }
  if (last < text.length) parts.push(run(text.slice(last)))
  return new Paragraph({
    children: parts,
    alignment: o.align ?? AlignmentType.JUSTIFIED,
    spacing: { ...DOUBLE, before: 0, after: 0 },
    indent: o.noIndent ? undefined : { firstLine: 720 },
  })
}
const H1 = (text) => new Paragraph({ children: [run(text, { bold: true })], spacing: { ...DOUBLE, before: 240, after: 0 }, keepNext: true })
const H2 = (text) => new Paragraph({ children: [run(text, { bold: true, italics: true })], spacing: { ...DOUBLE, before: 0, after: 0 }, keepNext: true })
const centre = (children, after = 0) => new Paragraph({ children, alignment: AlignmentType.CENTER, spacing: { ...DOUBLE, after } })

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const borders = { top: border, bottom: border, left: border, right: border }
function table(widths, rows) {
  const total = widths.reduce((a, b) => a + b, 0)
  return new Table({
    width: { size: total, type: WidthType.DXA },
    columnWidths: widths,
    rows: rows.map((cells, r) =>
      new TableRow({
        tableHeader: r === 0,
        cantSplit: true,
        children: cells.map((c, i) =>
          new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            borders,
            verticalAlign: VerticalAlign.TOP,
            shading: r === 0 ? { type: ShadingType.CLEAR, color: 'auto', fill: 'F2F2F2' } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: [run(c, { size: 21, bold: r === 0 })], spacing: { line: 260, lineRule: LineRuleType.AUTO } })],
          }),
        ),
      }),
    ),
  })
}
const caption = (text) => new Paragraph({ children: [run(text, { italics: true, size: 22 })], spacing: { before: 120, after: 120 }, keepNext: true })
const gap = () => new Paragraph({ children: [run('')], spacing: { after: 120 } })
const ref = (text) => {
  const parts = []
  const re = /(\*[^*]+\*)/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(run(text.slice(last, m.index)))
    parts.push(run(m[0].slice(1, -1), { italics: true }))
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(run(text.slice(last)))
  return new Paragraph({ children: parts, spacing: { line: 276, lineRule: LineRuleType.AUTO, after: 120 }, indent: { left: 720, hanging: 720 } })
}

const body = [
  // ---------------- Title block (as in the proposal)
  centre([run('OB PROJECT REPORT', { bold: true, size: 20, spacing: 40 })]),
  centre([run('An AI-Based Intervention to Help Serving Staff Execute Service Standards in Real Time', { bold: true, size: 28 })]),
  centre([run('TableMate: an employee-centric service copilot', { italics: true })]),
  centre([run('Working Group: B3', { bold: true })]),
  centre([run('Members: Drishti Gulati, Div Mehta, Sehaj Mittal, Vidush Srivastava, Shobith Das, Arnavi Khandelwal, Jonnah Harshith')], 240),

  P('Imagine a fine-dining server looking after six tables at once, each at a different stage of the meal. Greeting on time, confirming allergies, checking back after the main course, clearing plates and presenting the bill are each simple standards, but together they create heavy cognitive demands during a busy shift. When a step is missed, the guest notices the server, not the cause; and when the delay actually began in the kitchen, the server is still often the one who is blamed. This report diagnoses that issue, presents TableMate, the AI-enabled service copilot our group designed and prototyped in response, and examines its feasibility and implications through the lens of Organizational Behaviour (OB).'),

  // ---------------- 1
  H1('1. Issue Discussed and Diagnosis'),
  H2('1.1 The organizational issue'),
  P('The issue is an employee-centric one: frontline servers know their restaurant’s service standards but cannot reliably execute all of them under peak load, and they are held responsible for service lapses regardless of whether they controlled the step that failed. The result is a recurring pattern of missed or late service steps, guest complaints and lost repeat visits (Chung & Hoffman, 1998), together with employee frustration, a sense of unfair treatment and turnover in a sector that already struggles to retain staff. The organization experiences the symptom (inconsistent service); the employee experiences the cause (overload and unfair blame).'),
  H2('1.2 Underlying reasons and contributing factors'),
  P('**Cognitive overload at peaks.** Every table generates its own sequence of time-bound tasks. With several tables seated together, the server must hold the state of each one in working memory while also carrying plates, taking orders and answering questions. Lapses are therefore predictable at exactly the moments that matter most.'),
  P('**Information asymmetry between kitchen and floor.** Servers usually learn that a dish is late, has run out or clashes with a guest’s allergy only when they walk to the pass. Guests ask first; the server apologizes without knowing why. The delay is a process problem, but it surfaces as a server problem.'),
  P('**Responsibility assigned without evidence.** Most restaurants record when an order is fired and when the bill is paid, but nothing records which step in between ran late or who controlled it. Managers judge from what they see on the floor, so blame falls on the most visible person.'),
  P('**Emotional labour.** Servers must remain calm and warm while absorbing guests’ frustration about delays they did not cause, a form of surface acting that drains energy and is linked to burnout (Hochschild, 1983; Grandey, 2000).'),
  P('**Diversity of staff and guests.** Indian fine-dining floors are multilingual, and not every server reads, hears or moves in the same way. Standard operating procedures written in one language, and verbal briefings at the start of a shift, do not reach everyone equally (Shore et al., 2011).'),
  P('**Monitoring-oriented technology.** Existing tools tend to measure staff (sales leaderboards, camera analytics, ticket-time dashboards for managers) rather than support them. Such electronic monitoring raises stress and reduces trust unless its purpose is developmental and transparent (Ravid et al., 2020).'),
  H2('1.3 Applying OB concepts to the issue'),
  P('**Cognitive Load Theory** (Sweller, 1988) explains why individually simple standards fail together: working memory is limited, and when the number of concurrent items exceeds it, performance drops regardless of motivation or skill. The problem is therefore one of task design, not effort.'),
  P('**Attribution Theory** (Kelley, 1967) explains how responsibility is assigned. Observers judge cause from consistency, distinctiveness and consensus information; when that information is missing, they tend to make the *fundamental attribution error*, over-attributing outcomes to the person rather than the situation (Ross, 1977). A late main course is therefore read as a careless server rather than an overloaded grill station.'),
  P('**Equity Theory and organizational justice** (Adams, 1963; Colquitt, 2001) explain the employee reaction. When servers are blamed for outcomes they did not control, distributive justice is violated; when there is no transparent process for deciding who was responsible, procedural justice is violated; and when criticism is delivered publicly or personally, interactional justice suffers. Perceived injustice reduces commitment and increases withdrawal.'),
  P('**The Job Demands-Resources model** (Bakker & Demerouti, 2007) frames the overall picture: peak-time demands (concurrent tables, emotional labour, information gaps) are high, while job resources (timely information, support from colleagues and managers, feedback) are low. This combination predicts exhaustion and disengagement.'),
  P('**Self-Determination Theory** (Deci & Ryan, 1985; Ryan & Deci, 2000) adds a warning about the obvious fix. More supervision would undermine autonomy and, if experienced as surveillance, reduce intrinsic motivation. Any intervention must therefore support competence and autonomy rather than control.'),

  // ---------------- 2
  H1('2. Proposed Solution and Justification'),
  H2('2.1 The proposed solution'),
  P('We propose and have prototyped **TableMate**, an AI-enabled service copilot that runs on servers’ phones, the kitchen pass and the manager’s screen. It listens to events the restaurant’s point-of-sale system already produces (table seated, order fired, dish ready, bill requested) and turns them into a small number of timely, explained suggestions. It requires no new hardware and no extra data entry. Its main components are summarized in Table 1.'),
  caption('Table 1. TableMate components, the cause each addresses and the OB concept behind it'),
  table([2200, 3300, 2100, 1426], [
    ['Component', 'What it does', 'Cause addressed', 'OB concept'],
    ['Next three moves', 'Each server sees only the three most important things to do now, each with a one-line reason (“Why this first”). Any card can be postponed.', 'Cognitive overload', 'Cognitive Load Theory; autonomy (SDT)'],
    ['Kitchen–floor relay', 'Late dishes, run-outs and chef answers reach the server as cards before the guest asks; the pass sees tickets ordered by the restaurant’s own priorities.', 'Information asymmetry', 'Job resources (JD-R)'],
    ['Allergy and diet safety check', 'Rule-based check of every dish against the table’s allergies and diet; the server can update a table’s needs from the menu and the kitchen is alerted again.', 'Safety risk under load', 'Procedural justice; task design'],
    ['Delay receipts', 'Each step of a visit is timed against the standard and marked as floor-controlled or kitchen-controlled.', 'Blame without evidence', 'Attribution Theory; organizational justice'],
    ['Private progress and practice', 'Personal XP, streaks and badges visible only to the server; role-play practice of hard moments, rated kindly out of five with praise first and one tip.', 'Monitoring-oriented tools; emotional labour', 'SDT; Feedback Intervention Theory; self-efficacy'],
    ['Manager floor view', 'Load by section, suggested handovers (for example to a server who speaks the guests’ language) and process bottlenecks; no rankings of individual staff.', 'Uneven load; diversity', 'Fair process; inclusion'],
    ['Inclusive design', 'Six languages, read-aloud, large text, colour-safe cues and gender-neutral wording.', 'Diverse workforce', 'Inclusion (Shore et al., 2011)'],
  ]),
  gap(),
  H2('2.2 How the solution resolves the issue'),
  P('Each element is aimed at a diagnosed cause rather than at the symptom. The *next three moves* externalize the mental checklist, so working memory is spent on the guest instead of on remembering what is due. The *kitchen–floor relay* closes the information gap, so a server can tell the guests at table four that their mains are six minutes behind before the guest asks. The *delay receipt* supplies the missing consistency and distinctiveness information, so a manager reviewing a late table sees that the grill ran nine minutes over while every floor-controlled step was on time. The *private progress and practice* features give servers a safe place to build confidence for difficult conversations, which reduces the emotional cost of those moments when they happen for real.'),
  H2('2.3 OB concepts and theories informing the solution'),
  P('The design applies **Cognitive Load Theory** by limiting the display to three prioritized items and by attaching a short reason to each, so guidance is understood rather than merely followed. **Self-Determination Theory** shaped the decision that every card is a suggestion: servers can postpone any task, choose their language and comfort settings, and see only their own progress, supporting autonomy and competence. **Feedback Intervention Theory** (Kluger & DeNisi, 1996) informed the rule that feedback is about the task (“T4 is waiting on the bill”) and never about the person (“you are slow”), because feedback that draws attention to the self can reduce performance. The practice room applies the same principle and **self-efficacy** theory (Bandura, 1977): replies are rated out of five, scored leniently, and every note opens with specific praise before a single, gentle suggestion. **Goal-setting theory** (Locke & Latham, 2002) underpins the shared team goal and personal bests, which are specific and attainable without pitting colleagues against each other. Finally, **Attribution Theory** and **organizational justice** informed the delay receipts and the rule that managers never see per-person rankings.'),
  H2('2.4 Justification for this approach'),
  P('Three alternatives were considered and rejected. *More supervision* would add a demand rather than a resource and would be experienced as control, undermining autonomy. *More classroom training* would not help, because servers already know the standards; the gap is in execution under load, not knowledge. *Monitoring technology* such as camera analytics or sales leaderboards would measure the problem without relieving it and would raise perceived surveillance (Ravid et al., 2020); research on gamification also shows that public leaderboards can reduce motivation for some participants (Hanus & Fox, 2015).'),
  P('The chosen approach suits the organizational context. Fine-dining restaurants in India already run point-of-sale systems such as Petpooja and use smartphones on the floor, so the copilot fits existing routines and equipment. It reduces job demands while adding job resources, it protects staff from unfair attribution, and it gives managers better information instead of more control. Because it works from events that are already recorded, the cost of adoption is low and the benefit is visible in the first shift, which matters for adoption in a high-turnover, time-pressed setting (Rogers, 2003).'),

  // ---------------- 3
  H1('3. AI Integration and Implementation Feasibility'),
  H2('3.1 How AI is integrated into the design'),
  P('TableMate is not an “AI-first” tool that hands decisions to a chatbot. It is a service system with AI built into it in three layers, each working inside clear constraints (Table 2). The restaurant’s own rules form the foundation; machine learning sharpens the timing; and generative AI turns the result into simple, helpful language. Each layer can only act on what the layer below allows, so the AI simplifies the server’s work without ever taking control of it.'),
  P('This design is a deliberate choice. Staff tend to stop trusting an algorithm after seeing it make a single mistake (Dietvorst et al., 2015), so the decisions where a mistake is costly (allergies, timing standards) stay rule-based and explainable, while AI is used where it clearly helps: anticipating delays, finding the right words and coaching. The server stays in charge: every card can be postponed, and its reason is always shown.'),
  caption('Table 2. The three layers of AI integration and the constraint on each'),
  table([1900, 4200, 2926], [
    ['Layer', 'What it does', 'Constraint'],
    ['Rules (foundation)', 'Encodes the restaurant’s service standards, priorities and allergen and diet tags; decides what is due, what is late and which dishes are safe for a table.', 'Fixed and auditable; set by the restaurant; no AI can override it.'],
    ['Machine learning (timing)', 'Learns from the restaurant’s own point-of-sale history how long each course and dish usually takes at each time of night, forecasts which tables and stations will run late, and moves cards earlier as a result. It improves with every shift.', 'Predicts process timing only; trained on process data, never used to score or rank individuals.'],
    ['Generative AI (language)', 'Writes each card in plain words in the server’s language; answers menu questions; suggests dishes from a list already filtered for safety; plays guests in practice and gives kind, praise-first feedback; summarizes a shift.', 'Works only with what the lower layers provide; cannot change a safety decision; every output is a suggestion.'],
  ]),
  gap(),
  H2('3.2 How the solution functions in practice'),
  P('When a party with a nut allergy is seated, the rules layer creates a greeting card asking the server to confirm the allergy with the kitchen. While the mains cook, the learning layer forecasts that the grill will run late at this hour, and the language layer words a heads-up for the server to give the table before the guests ask. If a guest wants something spicy but mild for a child, the server types the request into the table’s menu and receives safe suggestions with a line to say. At the end of the shift the server gets a private recap, one tip and an optional practice role-play.'),
  H2('3.3 Implementation in a real organization: a four-step rollout'),
  P('**Preparation:** connect the point-of-sale system, enter the restaurant’s service standards and tag each dish with its allergens.', { noIndent: true }),
  P('**Pilot:** run the copilot in one section for four to six weeks with the manager and two or three servers as champions, while the learning layer calibrates to the restaurant’s own timings.', { noIndent: true }),
  P('**Evaluation:** compare missed or late steps, guest complaints and staff perceptions of surveillance, autonomy and fairness before and after.', { noIndent: true }),
  P('**Scale:** extend to all sections and outlets, involving staff throughout, since perceived usefulness and ease of use drive acceptance of new technology (Davis, 1989).', { noIndent: true }),
  H2('3.4 Requirements, challenges and limitations of industry rollout'),
  P('**Requirements:** point-of-sale access, a phone per server, a screen at the pass, reliable Wi-Fi and an accurate, allergen-tagged menu kept current by the restaurant.', { noIndent: true }),
  P('**Challenges:** point-of-sale systems differ across vendors and chains; many restaurants keep their standards informally rather than in writing; and staff may first read the tool as monitoring, so managers must explain its purpose and show that data is not used against individuals.', { noIndent: true }),
  P('**Limitations:** each new outlet needs several weeks of its own data before forecasts are reliable; the safety check is only as good as the menu tags; generative AI can still word things poorly, which is why it is kept to suggestions; and the benefit depends on manager support, since a copilot cannot fix understaffing or a slow kitchen.', { noIndent: true }),
  P('**Costs and compliance:** subscription, devices and training add cost for smaller restaurants, and guest and staff data must be handled under India’s Digital Personal Data Protection Act, 2023.', { noIndent: true }),
  H2('3.5 Broader implications of using AI for this issue'),
  P('AI at work can become *algorithmic management*, in which algorithms direct, evaluate and discipline workers (Kellogg et al., 2020). TableMate is designed against this: its guidance is advisory, its evaluations are private and its evidence protects staff rather than ranking them. Whether such tools support or surveil depends on choices about visibility, purpose and control, which are OB decisions as much as technical ones.'),

  // ---------------- 4
  H1('4. Implications of the Proposed Solution'),
  H2('4.1 Implications for employees, managers, teams and the organization'),
  P('The expected implications for each level are summarized in Table 3.', { noIndent: false }),
  caption('Table 3. Expected implications by stakeholder'),
  table([1700, 3700, 3626], [
    ['Stakeholder', 'Expected benefits', 'Risks to manage'],
    ['Employees', 'Lower cognitive load at peaks; fewer surprises from the kitchen; protection from unfair blame; private progress and safe practice; support in their own language.', 'Over-reliance on prompts; feeling watched if the purpose is not explained; pressure from game elements.'],
    ['Managers', 'Evidence on where time is lost; suggested handovers; fairer, data-informed conversations with staff.', 'Temptation to use timing data to judge individuals; less informal observation of the floor.'],
    ['Teams', 'Better kitchen–floor coordination; shared team goal and peer recognition; help directed to whoever needs it.', 'Friction if the kitchen feels blamed; uneven adoption across shifts.'],
    ['Organization', 'More consistent service, fewer complaints, safer allergy handling; staffing insight; lower turnover.', 'Integration and data-quality costs; vendor dependency; data-protection duties.'],
  ]),
  gap(),
  H2('4.2 Potential benefits'),
  P('Job demands fall while job resources rise, which the Job Demands-Resources model links to engagement rather than exhaustion (Bakker & Demerouti, 2007), and fairer attribution should strengthen perceived justice and organizational support (Eisenberger et al., 1986).'),
  H2('4.3 Unintended consequences and ethical concerns'),
  P('**Surveillance creep:** timing data could later be used to rank staff, so the manager view has no per-person rankings and this should be written into policy.', { noIndent: true }),
  P('**Over-reliance:** servers may stop using their own judgement; showing each card’s reason and allowing it to be postponed keeps judgement active.', { noIndent: true }),
  P('**Gamification pressure:** points and streaks are private, capped daily and can be switched off.', { noIndent: true }),
  P('**AI fairness:** scoring may disadvantage staff who express themselves differently, so it is lenient, opens with praise and is for learning, not assessment.', { noIndent: true }),
  P('**Kitchen relations and privacy:** delay receipts describe processes, not people, and guest data is kept only for the visit.', { noIndent: true }),
  H2('4.4 Influence on workplace behaviour, processes and outcomes'),
  P('Servers are expected to act earlier and more calmly, ask for help more readily and practise conversations they would otherwise avoid. Because errors appear as process information rather than personal failure, the tool supports psychological safety (Edmondson, 1999). The intended outcomes are more consistent service, fewer incidents and lower turnover.'),

  H1('Conclusion'),
  P('Service failures on the floor stem from cognitive overload, kitchen–floor information gaps and the misattribution of process delays to servers. Grounded in Cognitive Load Theory, Attribution Theory, organizational justice, Self-Determination Theory and the Job Demands-Resources model, TableMate addresses these causes with a few explained suggestions, a kitchen–floor relay, fair delay records and private, kind learning, integrating AI as a constrained layer that helps frontline employees deliver the standards they already know.'),

  // ---------------- References
  gap(),
  centre([run('References', { bold: true })]),
  ref('Adams, J. S. (1963). Towards an understanding of inequity. *Journal of Abnormal and Social Psychology, 67*(5), 422–436.'),
  ref('Bakker, A. B., & Demerouti, E. (2007). The Job Demands-Resources model: State of the art. *Journal of Managerial Psychology, 22*(3), 309–328.'),
  ref('Bandura, A. (1977). Self-efficacy: Toward a unifying theory of behavioral change. *Psychological Review, 84*(2), 191–215.'),
  ref('Chung, B., & Hoffman, K. D. (1998). Critical incidents: Service failures that matter most. *Cornell Hotel and Restaurant Administration Quarterly, 39*(3), 66–71.'),
  ref('Colquitt, J. A. (2001). On the dimensionality of organizational justice: A construct validation of a measure. *Journal of Applied Psychology, 86*(3), 386–400.'),
  ref('Davis, F. D. (1989). Perceived usefulness, perceived ease of use, and user acceptance of information technology. *MIS Quarterly, 13*(3), 319–340.'),
  ref('Deci, E. L., & Ryan, R. M. (1985). *Intrinsic motivation and self-determination in human behavior*. Plenum.'),
  ref('Dietvorst, B. J., Simmons, J. P., & Massey, C. (2015). Algorithm aversion: People erroneously avoid algorithms after seeing them err. *Journal of Experimental Psychology: General, 144*(1), 114–126.'),
  ref('Edmondson, A. (1999). Psychological safety and learning behavior in work teams. *Administrative Science Quarterly, 44*(2), 350–383.'),
  ref('Eisenberger, R., Huntington, R., Hutchison, S., & Sowa, D. (1986). Perceived organizational support. *Journal of Applied Psychology, 71*(3), 500–507.'),
  ref('Grandey, A. A. (2000). Emotion regulation in the workplace: A new way to conceptualize emotional labor. *Journal of Occupational Health Psychology, 5*(1), 95–110.'),
  ref('Hanus, M. D., & Fox, J. (2015). Assessing the effects of gamification in the classroom: A longitudinal study on intrinsic motivation, social comparison, satisfaction, effort, and academic performance. *Computers & Education, 80*, 152–161.'),
  ref('Hochschild, A. R. (1983). *The managed heart: Commercialization of human feeling*. University of California Press.'),
  ref('Kellogg, K. C., Valentine, M. A., & Christin, A. (2020). Algorithms at work: The new contested terrain of control. *Academy of Management Annals, 14*(1), 366–410.'),
  ref('Kelley, H. H. (1967). Attribution theory in social psychology. In *Nebraska Symposium on Motivation* (Vol. 15, pp. 192–238).'),
  ref('Kluger, A. N., & DeNisi, A. (1996). The effects of feedback interventions on performance: A historical review, a meta-analysis, and a preliminary feedback intervention theory. *Psychological Bulletin, 119*(2), 254–284.'),
  ref('Locke, E. A., & Latham, G. P. (2002). Building a practically useful theory of goal setting and task motivation: A 35-year odyssey. *American Psychologist, 57*(9), 705–717.'),
  ref('Ravid, D. M., Tomczak, D. L., White, J. C., & Behrend, T. S. (2020). EPM 20/20: A review, framework, and research agenda for electronic performance monitoring. *Journal of Management, 46*(1), 100–126.'),
  ref('Rogers, E. M. (2003). *Diffusion of innovations* (5th ed.). Free Press.'),
  ref('Ross, L. (1977). The intuitive psychologist and his shortcomings: Distortions in the attribution process. *Advances in Experimental Social Psychology, 10*, 173–220.'),
  ref('Ryan, R. M., & Deci, E. L. (2000). Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. *American Psychologist, 55*(1), 68–78.'),
  ref('Shore, L. M., Randel, A. E., Chung, B. G., Dean, M. A., Holcombe Ehrhart, K., & Singh, G. (2011). Inclusion and diversity in work groups: A review and model for future research. *Journal of Management, 37*(4), 1262–1289.'),
  ref('Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. *Cognitive Science, 12*(2), 257–285.'),
]

const doc = new Document({
  creator: 'Working Group B3',
  title: 'OB Project Report: TableMate',
  styles: { default: { document: { run: { font: FONT, size: 24 } } } },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24 })] })] }),
      },
      children: body,
    },
  ],
})

Packer.toBuffer(doc).then((b) => {
  fs.writeFileSync(process.argv[2], b)
  console.log('written', process.argv[2])
})
