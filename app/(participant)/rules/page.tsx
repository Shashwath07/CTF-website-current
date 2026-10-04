export default function RulesPage() {
  const rules = [
    {
      number: "01",
      title: "Eligibility & Participation",
      content:
        "Participation format will follow the final event registration rules on Unstop. Participants must use only the account assigned to them for the competition. Account sharing is not allowed.",
    },
    {
      number: "02",
      title: "Competition Flow",
      content:
        "After logging in, participants must start the competition from their dashboard. Challenges are assigned through the platform, and completed challenges are followed by the next eligible challenge.",
    },
    {
      number: "03",
      title: "Flag Format",
      content: (
        <>
          Valid flags will follow the format:
          <code className="rules-code">DDC{"{...}"}</code>
          Flags must be submitted through the official Submissions page against
          the correct Challenge ID.
        </>
      ),
    },
    {
      number: "04",
      title: "Google and Documentation Are Allowed",
      content:
        "Participants may use search engines, documentation, manuals, CyberChef, Linux tools, Wireshark, Ghidra, scripting languages and other normal cybersecurity tools required to solve challenges.",
      allowed: true,
    },
    {
      number: "05",
      title: "AI Tools Are Not Allowed",
      content:
        "ChatGPT, Claude, Gemini, Copilot and other generative-AI assistants must not be used to solve challenges, generate solutions, analyze challenge artifacts or obtain flags during the competition.",
      warning: true,
    },
    {
      number: "06",
      title: "Do Not Share Solutions or Flags",
      content:
        "Sharing flags, answers, challenge solutions, scripts specifically written to solve a challenge, or substantial hints with other participants during the event is prohibited.",
      warning: true,
    },
    {
      number: "07",
      title: "Only Attack the Challenge Material",
      content:
        "Participants may analyze and manipulate the files, browser state, challenge pages and artifacts intentionally provided as part of a challenge. Do not attack the actual DDC CTF platform, authentication system, database, admin interface, other participants or club infrastructure.",
      warning: true,
    },
    {
      number: "08",
      title: "No Unauthorized Scanning or Exploitation",
      content:
        "Do not run automated vulnerability scanners, brute-force attacks, denial-of-service attacks, credential attacks or destructive tools against the competition platform.",
      warning: true,
    },
    {
      number: "09",
      title: "Challenge-Specific Browser Manipulation Is Allowed",
      content:
        "If a challenge requires inspecting source code, DevTools, cookies, localStorage, sessionStorage, network requests or similar browser data, doing so is permitted only within the intended challenge environment.",
      allowed: true,
    },
    {
      number: "10",
      title: "Downloaded Artifacts May Be Analyzed Locally",
      content:
        "Participants may inspect provided binaries, images, PCAP files, archives, Git repositories, memory-like artifacts and other challenge files using appropriate local tools.",
      allowed: true,
    },
    {
      number: "11",
      title: "Hints May Carry Penalties",
      content:
        "If hints are enabled for a challenge, using a hint may result in a point deduction. Any penalty will be shown before the hint is revealed.",
    },
    {
      number: "12",
      title: "Challenge Issues / Revoke Requests",
      content:
        "If a participant believes an assigned challenge is broken or inaccessible, they must use the official challenge-revoke/request mechanism or contact an organizer. Participants should not repeatedly request a different challenge simply because the current one is difficult.",
    },
    {
      number: "13",
      title: "Do Not Attempt to Bypass Progression",
      content:
        "Participants must not manipulate the real platform state to mark challenges as solved, assign themselves challenges, alter scores, bypass challenge progression or access administrator functionality.",
      warning: true,
    },
    {
      number: "14",
      title: "Submission Abuse Is Prohibited",
      content:
        "Automated flag brute forcing or mass submission attempts are not allowed. Repeated invalid submissions may be rate-limited by the platform.",
      warning: true,
    },
    {
      number: "15",
      title: "Respect Event Timing",
      content:
        "Challenges may only be solved and submitted during the official competition period. Challenges may also be released in waves; unreleased challenges must not be accessed through attempts to bypass platform restrictions.",
    },
    {
      number: "16",
      title: "Organizer Decisions",
      content:
        "Organizers may disable or replace a broken challenge, correct scoring errors, investigate suspicious activity or disqualify participants for serious rule violations. Any such action should be based on competition logs and the published rules.",
    },
    {
      number: "17",
      title: "Report Technical Problems Immediately",
      content:
        "Login problems, corrupted downloads, inaccessible challenges or platform errors should be reported to the organizing team as soon as possible, along with the Challenge ID and relevant screenshot/error information.",
    },
    {
      number: "18",
      title: "Have Fun and Play Fair",
      content:
        "The purpose of the event is to test cybersecurity problem-solving, investigation and technical skills. Explore the challenges aggressively—but keep all activity within the boundaries of the competition.",
    },
  ];

  return (
    <main className="arena-route rules-page">
      <div className="rules-header">
        <div>
          <p className="arena-kicker">DDC CTF // PARTICIPANT HANDBOOK</p>

          <h1>Rules</h1>

          <p className="rules-intro">
            Read the following rules carefully before participating in the
            competition. By taking part in DDC CTF, participants agree to
            follow these rules and keep all activity within the intended
            challenge environment.
          </p>
        </div>

        <div className="rules-status">
          <span className="rules-status-dot" />
          <span>RULES ACTIVE</span>
        </div>
      </div>

      <section className="rules-important">
        <div className="rules-important-header">
          <span className="rules-alert-icon">!</span>

          <div>
            <h2>Important</h2>
            <p>
              The following activities are explicitly permitted or prohibited
              during the competition.
            </p>
          </div>
        </div>

        <div className="rules-permission-grid">
          <div className="rules-permission allowed">
            <h3>✓ Allowed</h3>

            <p>
              Google, documentation, CyberChef, Linux tools, Wireshark, Ghidra,
              scripts you write yourself, DevTools and normal cybersecurity
              utilities.
            </p>
          </div>

          <div className="rules-permission prohibited">
            <h3>✕ Not Allowed</h3>

            <p>
              AI assistants, sharing flags/solutions, attacking the real
              platform, brute-forcing submissions, attacking other
              participants, or disrupting the event.
            </p>
          </div>
        </div>
      </section>

      <section className="rules-list">
        {rules.map((rule) => (
          <article
            key={rule.number}
            className={`rule-card ${
              rule.warning ? "rule-card-warning" : ""
            }`}
          >
            <div className="rule-number">{rule.number}</div>

            <div className="rule-content">
              <div className="rule-title-row">
                <h2>{rule.title}</h2>

                {rule.allowed && (
                  <span className="rule-badge rule-badge-allowed">
                    ALLOWED
                  </span>
                )}

                {rule.warning && (
                  <span className="rule-badge rule-badge-warning">
                    PROHIBITED
                  </span>
                )}
              </div>

              <div className="rule-description">{rule.content}</div>
            </div>
          </article>
        ))}
      </section>

      <section className="rules-footer">
        <div className="rules-footer-icon">◆</div>

        <div>
          <h2>Play Fair. Think Smart. Break Challenges.</h2>

          <p>
            Use your cybersecurity skills to investigate and solve the
            challenges—but never target the competition infrastructure itself.
          </p>
        </div>
      </section>
    </main>
  );
}
