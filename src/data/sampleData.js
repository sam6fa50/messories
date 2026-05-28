const NOW = Date.now();
const DAY = 86400000;
const HOUR = 3600000;
const MIN = 60000;

let _id = 0;
const m = (sender, content, t, extra = {}) => ({
  id: ++_id,
  sender_name: sender,
  timestamp_ms: NOW - t,
  content,
  ...extra,
});
const react = (...rs) => ({ reactions: rs.map(([actor, emoji]) => ({ actor, reaction: emoji })) });
const photo = (uri, w, h) => ({ photos: [{ uri, width: w || 1080, height: h || 1350 }] });
const photos = (...uris) => ({ photos: uris.map((u) => ({ uri: u, width: 1080, height: 1080 })) });
const audio = (uri, dur) => ({ audio_files: [{ uri, duration_s: dur }] });
const video = (uri, dur, w, h) => ({
  videos: [{ uri, duration_s: dur, width: w || 1080, height: h || 1350 }],
});
const reply = (sender, snippet) => ({ reply_to: { sender, snippet } });

let _callPairId = 0;
const call = (initiator, durationSecs, t, opts = {}) => {
  const outcome = opts.outcome || (durationSecs > 0 ? "completed" : "missed");
  const base = {
    sender_name: initiator,
    content: null,
    is_call: true,
    call_duration: durationSecs,
    is_video_call: !!opts.video,
    call_outcome: outcome,
    call_participants: opts.participants || null,
  };
  if (outcome !== "completed" || durationSecs <= 0) {
    return [{ ...base, id: ++_id, timestamp_ms: NOW - t, call_kind: "missed" }];
  }
  const pairId = ++_callPairId;
  const startMs = NOW - t;
  const endMs = startMs + durationSecs * 1000;
  return [
    { ...base, id: ++_id, timestamp_ms: startMs, call_kind: "start", call_pair_id: pairId },
    { ...base, id: ++_id, timestamp_ms: endMs, call_kind: "end", call_pair_id: pairId },
  ];
};

const maya = {
  id: "maya_chen",
  title: "Maya Chen",
  participants: ["You", "Maya Chen"],
  is_group: false,
  avatar_color: "#b8836b",
  avatar_initials: "MC",
  first_message_ms: NOW - DAY * 365 * 8,
  total_messages: 14328,
  messages: [
    m("Maya Chen", "ok the way i just saw a man walking three corgis", 2 * DAY + 3 * HOUR),
    m("Maya Chen", "and one was wearing a tiny RAINCOAT", 2 * DAY + 3 * HOUR - 4 * MIN),
    m("You", "send pic immediately", 2 * DAY + 3 * HOUR - 6 * MIN),
    m("Maya Chen", null, 2 * DAY + 3 * HOUR - 8 * MIN, photo("ph://corgi-1", 1080, 1350)),
    m("Maya Chen", null, 2 * DAY + 3 * HOUR - 9 * MIN, video("vid://corgi-walk", 14, 1080, 1920)),
    m("You", "i'm sobbing", 2 * DAY + 3 * HOUR - 10 * MIN, react(["Maya Chen", "😂"])),
    m("Maya Chen", "right??? the LITTLE HOOD", 2 * DAY + 3 * HOUR - 11 * MIN),
    m("You", "i would commit crimes for that dog", 2 * DAY + 3 * HOUR - 13 * MIN, { ...react(["Maya Chen", "😂"]), ...reply("Maya Chen", "right??? the LITTLE HOOD") }),
    m("You", "ok unrelated but did you see what celeste posted", 2 * DAY + 2 * HOUR),
    m("Maya Chen", "which one. the one about the breakup", 2 * DAY + 2 * HOUR - 2 * MIN),
    m("You", "no the cryptic ass quote thing", 2 * DAY + 2 * HOUR - 3 * MIN),
    m("Maya Chen", null, 2 * DAY + 2 * HOUR - 5 * MIN, {
      share: { caption: "look at this 😭", original_content_owner: "celesteposts", post_caption: "the truth is i never wanted to be loved softly", kind: "post" },
    }),
    m("You", "GIRL", 2 * DAY + 2 * HOUR - 6 * MIN, react(["Maya Chen", "💀"])),
    m("You", "anyway u free friday", 2 * DAY + 1 * HOUR),
    m("Maya Chen", "friday yes. saturday i have that wedding 😩", 2 * DAY + 1 * HOUR - 1 * MIN),
    m("Maya Chen", null, 2 * DAY + 1 * HOUR - 3 * MIN, audio("voice://maya-1", 47)),
    m("You", "lmaoooo the voice memo lore", 2 * DAY + 1 * HOUR - 6 * MIN, react(["Maya Chen", "❤️"])),
    m("You", "ok 7pm? new place on washington?", 2 * DAY + 50 * MIN),
    m("Maya Chen", "yes. dress code", 2 * DAY + 49 * MIN),
    m("You", "low effort high impact", 2 * DAY + 48 * MIN),
    m("Maya Chen", "iconic", 2 * DAY + 47 * MIN, react(["You", "👑"])),
    m("You", "ok i did it", 5 * DAY + 4 * HOUR),
    m("You", "i quit", 5 * DAY + 4 * HOUR - 1 * MIN),
    m("Maya Chen", "WAIT", 5 * DAY + 4 * HOUR - 2 * MIN),
    m("Maya Chen", "you actually did it??", 5 * DAY + 4 * HOUR - 2 * MIN),
    m("You", "i actually did it", 5 * DAY + 4 * HOUR - 3 * MIN, react(["Maya Chen", "🥹"], ["Maya Chen", "🔥"])),
    m("Maya Chen", "im so proud of u i could cry", 5 * DAY + 4 * HOUR - 4 * MIN),
    m("Maya Chen", "what did david say", 5 * DAY + 4 * HOUR - 5 * MIN),
    m("You", "he was like 'i understand' in the most british way possible", 5 * DAY + 4 * HOUR - 7 * MIN),
    m("Maya Chen", "lmaooo he's so dry. ok celebratory dinner tomorrow im picking", 5 * DAY + 4 * HOUR - 8 * MIN),
    m("Maya Chen", "also i have to say. the timing is so you btw", 5 * DAY + 4 * HOUR - 8.5 * MIN, { ...reply("You", "i quit") }),
    m("You", "deal", 5 * DAY + 4 * HOUR - 9 * MIN),
    ...call("Maya Chen", 47 * 60 + 12, 4 * DAY + 22 * HOUR, { video: true }),
    ...call("Maya Chen", 0, 7 * DAY + 19 * HOUR, { video: false, outcome: "missed" }),
    ...call("You", 18 * 60 + 30, 7 * DAY + 9 * HOUR, { video: false }),
    ...call("Maya Chen", 4 * 60 + 9, 1 * DAY + 6 * HOUR, { video: true }),
  ],
};

const family = {
  id: "family",
  title: "Family ❤",
  participants: ["You", "Mom", "Dad", "Eli"],
  is_group: true,
  avatar_color: "#a64b2a",
  avatar_initials: "F",
  first_message_ms: NOW - DAY * 365 * 5,
  total_messages: 3104,
  messages: [
    m("Mom", "Good morning everyone ☀️", 1 * DAY + 9 * HOUR),
    m("Mom", null, 1 * DAY + 9 * HOUR - 1 * MIN, photo("ph://mom-garden", 1080, 1350)),
    m("Mom", null, 1 * DAY + 9 * HOUR - 1.5 * MIN, video("vid://mom-garden-tour", 38, 1080, 1080)),
    m("Mom", "The tomatoes are FINALLY coming in", 1 * DAY + 9 * HOUR - 2 * MIN, react(["You", "🍅"], ["Eli", "🍅"], ["Dad", "❤️"])),
    m("Dad", "She has been talking about these tomatoes for three months.", 1 * DAY + 8 * HOUR),
    m("Eli", "dad you don't have to text in full sentences in the group chat", 1 * DAY + 8 * HOUR - 5 * MIN, react(["You", "😂"], ["Mom", "😂"])),
    m("Dad", "Noted.", 1 * DAY + 7 * HOUR, react(["Eli", "💀"])),
    m("You", "are we still doing sunday dinner", 1 * DAY + 6 * HOUR),
    m("Mom", "Yes!! 6pm. Bring the bread from that place.", 1 * DAY + 5 * HOUR + 50 * MIN),
    m("Eli", "i'll be there but i'm bringing a friend if that's ok", 1 * DAY + 5 * HOUR),
    m("You", "ooh who", 1 * DAY + 5 * HOUR - 2 * MIN, { ...reply("Eli", "i'll be there but i'm bringing a friend if that's ok") }),
    m("Eli", "you'll see 😇", 1 * DAY + 5 * HOUR - 3 * MIN, { ...reply("You", "ooh who"), ...react(["You", "😭"]) }),
    m("Mom", "Of course honey 🤍 girl or boy", 1 * DAY + 4 * HOUR + 55 * MIN),
    m("Eli", "MOM", 1 * DAY + 4 * HOUR + 54 * MIN, react(["You", "💀"], ["Dad", "😂"])),
    m("Mom", "What", 1 * DAY + 4 * HOUR + 53 * MIN),
    m("Eli", "you can ask their name when they get here", 1 * DAY + 4 * HOUR + 52 * MIN),
    m("Mom", "Okay okay. Tell them I don't bite.", 1 * DAY + 4 * HOUR + 50 * MIN),
    m("Dad", "I might.", 1 * DAY + 4 * HOUR + 30 * MIN, react(["Eli", "😭"], ["You", "😭"], ["Mom", "😂"])),
    ...call("Mom", 1 * 60 * 60 + 23 * 60, 8 * DAY + 18 * HOUR, { video: true, participants: ["Mom", "Dad", "You"] }),
    ...call("Mom", 0, 3 * DAY + 11 * HOUR, { video: false, outcome: "missed" }),
    ...call("You", 22 * 60 + 41, 3 * DAY + 20 * HOUR, { video: true }),
  ],
};

const crew = {
  id: "college_crew",
  title: "College Crew",
  participants: ["You", "Priya", "Jules", "Sam", "Theo"],
  is_group: true,
  avatar_color: "#5c6b5a",
  avatar_initials: "CC",
  first_message_ms: NOW - DAY * 365 * 10,
  total_messages: 28991,
  messages: [
    m("Priya", "OK so portugal", 6 * HOUR),
    m("Priya", "i'm looking at flights and if we book by next week it's like 480 round trip from JFK", 6 * HOUR - 1 * MIN),
    m("Jules", "wait actually??", 6 * HOUR - 3 * MIN),
    m("Sam", "i'm in. lisbon or porto", 6 * HOUR - 4 * MIN),
    m("Theo", "both. obviously.", 6 * HOUR - 5 * MIN, react(["Priya", "🙌"], ["Jules", "🙌"])),
    m("You", "october?", 6 * HOUR - 7 * MIN),
    m("Priya", "october. the 9th-ish to the 18th", 6 * HOUR - 8 * MIN),
    m("Jules", null, 6 * HOUR - 12 * MIN, photos("ph://lisbon-1", "ph://lisbon-2", "ph://lisbon-3", "ph://lisbon-4")),
    m("Jules", null, 6 * HOUR - 11 * MIN, video("vid://lisbon-airbnb-tour", 52, 1080, 1920)),
    m("Jules", "found these on pinterest. the airbnb energy i'm seeking", 6 * HOUR - 13 * MIN, react(["Sam", "😍"], ["Theo", "😍"], ["You", "😍"], ["Priya", "😍"])),
    m("Theo", "ok but do we have a budget conversation now or do we just spend money and figure it out", 6 * HOUR - 20 * MIN),
    m("Sam", "the latter has historically not gone well for us", 6 * HOUR - 21 * MIN, { ...react(["Priya", "💀"]), ...reply("Theo", "ok but do we have a budget conversation now or do we just spend money and figure it out") }),
    m("You", "let's say 1800 each all in?", 6 * HOUR - 25 * MIN),
    m("Jules", "doable", 6 * HOUR - 26 * MIN),
    m("Priya", "doable", 6 * HOUR - 26 * MIN),
    m("Theo", "🫡", 6 * HOUR - 27 * MIN),
    m("Sam", null, 6 * HOUR - 30 * MIN, audio("voice://sam-1", 23)),
    m("Priya", "sam i love that for you but please type this out i'm at work", 6 * HOUR - 32 * MIN, react(["Jules", "😂"], ["Theo", "😂"], ["You", "😂"])),
    m("Sam", "i said. trip planning doc. i'll start one tonight. love u all", 6 * HOUR - 33 * MIN),
    ...call("Priya", 1 * 60 * 60 + 42 * 60 + 18, 2 * DAY + 21 * HOUR, { video: true, participants: ["You", "Priya", "Jules", "Sam", "Theo"] }),
    m("Jules", "wait can someone share screen i'm on phone", 2 * DAY + 20 * HOUR + 40 * MIN),
    m("Sam", "just sent the link in the call chat", 2 * DAY + 20 * HOUR + 38 * MIN),
    m("Theo", "y'all this airbnb has a POOL", 2 * DAY + 20 * HOUR + 5 * MIN),
    m("Priya", "BOOK IT", 2 * DAY + 20 * HOUR + 4 * MIN, react(["You", "🙌"], ["Jules", "🙌"], ["Sam", "🙌"])),
    ...call("Theo", 12 * 60 + 4, 5 * DAY + 22 * HOUR, { video: true }),
  ],
};

const jordan = {
  id: "jordan_studio",
  title: "Jordan — Studio Refrain",
  participants: ["You", "Jordan Vale"],
  is_group: false,
  avatar_color: "#3a2a1f",
  avatar_initials: "JV",
  first_message_ms: NOW - DAY * 365 * 2,
  total_messages: 412,
  messages: [
    m("Jordan Vale", "Hi! Just sent over the contract. Let me know if anything needs tweaking on your end.", 3 * DAY + 2 * HOUR),
    m("You", "Got it, looking now. The scope section looks right — only thing is the kickoff date, can we push to the 14th?", 3 * DAY + 1 * HOUR + 40 * MIN),
    m("Jordan Vale", "14th works. I'll resend.", 3 * DAY + 1 * HOUR + 30 * MIN),
    m("Jordan Vale", "Also — moodboard incoming. We're leaning quieter / more editorial than the last round.", 3 * DAY + 1 * HOUR + 28 * MIN),
    m("Jordan Vale", null, 3 * DAY + 1 * HOUR + 25 * MIN, photos("ph://mood-1", "ph://mood-2", "ph://mood-3")),
    m("You", "These are great. I'm hearing: warm neutrals, serif type, generous whitespace. Want me to put together a first round of directions for Tuesday?", 3 * DAY + 1 * HOUR + 10 * MIN),
    m("Jordan Vale", "Tuesday is perfect. Thank you!", 3 * DAY + 1 * HOUR),
    m("Jordan Vale", "One more thing — our CEO will probably want to weigh in at the round 2 review. Fair warning.", 3 * DAY + 50 * MIN, react(["You", "🫡"])),
    m("You", "noted. i'll add a slide titled 'the CEO corner' just in case", 3 * DAY + 40 * MIN, { ...reply("Jordan Vale", "One more thing — our CEO will probably want to weigh in at the round 2 review. Fair warning."), ...react(["Jordan Vale", "😂"]) }),
    ...call("Jordan Vale", 38 * 60 + 17, 2 * DAY + 17 * HOUR, { video: true }),
    ...call("Jordan Vale", 0, 1 * DAY + 15 * HOUR, { video: false, outcome: "declined" }),
  ],
};

const lena = {
  id: "lena_park",
  title: "Lena Park",
  participants: ["You", "Lena Park"],
  is_group: false,
  avatar_color: "#6b7a99",
  avatar_initials: "LP",
  first_message_ms: NOW - DAY * 365 * 6,
  total_messages: 2876,
  messages: [
    m("Lena Park", "i think about you sometimes when i'm cooking. weird thing to say. but you taught me how to make that pasta with the lemon and i make it like twice a month still", 47 * DAY),
    m("Lena Park", "anyway hi. i hope you're doing ok.", 47 * DAY - 1 * MIN, react(["You", "🥹"])),
    m("You", "lena!!! that is not weird at all. i am doing ok. i am doing better than ok actually", 46 * DAY + 22 * HOUR),
    m("You", "are you still in chicago?", 46 * DAY + 22 * HOUR - 2 * MIN),
    m("Lena Park", "yes. you still in new york?", 46 * DAY + 21 * HOUR),
    m("You", "yes. for now.", 46 * DAY + 20 * HOUR + 50 * MIN),
    m("Lena Park", "for now is such a new york answer", 46 * DAY + 20 * HOUR + 49 * MIN, react(["You", "😂"])),
    ...call("You", 2 * 60 * 60 + 11 * 60 + 4, 41 * DAY + 21 * HOUR, { video: true }),
  ],
};

const THREADS = [maya, family, crew, jordan, lena];

THREADS.forEach((t) => {
  const last = t.messages.reduce((a, b) => (a.timestamp_ms > b.timestamp_ms ? a : b));
  t.last_message = last;
  t.last_message_ms = last.timestamp_ms;
  t.messages.sort((a, b) => a.timestamp_ms - b.timestamp_ms);
});
THREADS.sort((a, b) => b.last_message_ms - a.last_message_ms);

export const SAMPLE_THREADS = THREADS;

export const SAMPLE_PROFILE = {
  displayName: "You",
  handle: "you",
  avatarUri: null,
  avatarColor: "#b8836b",
  initials: "Y",
};
