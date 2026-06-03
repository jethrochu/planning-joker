import {
  Check,
  Clipboard,
  Copy,
  Eye,
  Link as LinkIcon,
  Plus,
  RotateCcw,
  Users,
  Wifi,
  WifiOff
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { deckLabels, decks } from "./data";
import { createRoomId, getRoomIdFromHash, getRoomLink, normalizeRoomId, setRoomHash } from "./roomLinks";
import { getStoredDisplayName, setStoredDisplayName } from "./storage";
import {
  getAverageVote,
  getConnectedCount,
  getFinalResultText,
  getMostCommonVote,
  getVoteCounts,
  getVotedCount
} from "./summary";
import type { DeckType, PublicRoomState } from "./types";
import { usePlanningPokerRoom } from "./usePlanningPokerRoom";

function App() {
  const [roomId, setRoomId] = useState(() => getRoomIdFromHash());
  const [displayName, setDisplayName] = useState(() => getStoredDisplayName());

  useEffect(() => {
    const updateRoom = () => setRoomId(getRoomIdFromHash());
    window.addEventListener("hashchange", updateRoom);
    return () => window.removeEventListener("hashchange", updateRoom);
  }, []);

  function handleCreateRoom() {
    setRoomHash(createRoomId());
  }

  function handleJoinRoom(nextRoomId: string) {
    const normalized = normalizeRoomId(nextRoomId);
    if (normalized) setRoomHash(normalized);
  }

  function handleNameSubmit(name: string) {
    setStoredDisplayName(name.trim());
    setDisplayName(name.trim());
  }

  return (
    <main className="app-shell">
      <TopBar roomId={roomId} />
      {!roomId ? (
        <HomeScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      ) : !displayName ? (
        <JoinScreen roomId={roomId} onNameSubmit={handleNameSubmit} />
      ) : (
        <PokerRoom roomId={roomId} displayName={displayName} onChangeName={() => setDisplayName("")} />
      )}
    </main>
  );
}

function TopBar({ roomId }: { roomId: string }) {
  return (
    <header className="top-bar">
      <button className="brand" type="button" onClick={() => (window.location.hash = "")}>
        <span className="brand-mark">PJ</span>
        <span>Planning Joker</span>
      </button>
      <div className="top-meta">
        {roomId ? (
          <span className="room-chip">
            <LinkIcon size={15} aria-hidden="true" />
            {roomId}
          </span>
        ) : null}
      </div>
    </header>
  );
}

function HomeScreen({
  onCreateRoom,
  onJoinRoom
}: {
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
}) {
  const [joinCode, setJoinCode] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onJoinRoom(joinCode);
  }

  return (
    <section className="home-grid">
      <div className="home-primary">
        <h1>Planning poker that gets out of the meeting's way.</h1>
        <p>
          Create a temporary room, share the link, and reveal estimates when the team is ready.
        </p>
        <button className="primary-action" type="button" onClick={onCreateRoom}>
          <Plus size={18} aria-hidden="true" />
          Create room
        </button>
      </div>
      <form className="join-panel" onSubmit={handleSubmit}>
        <label htmlFor="room-code">Room code</label>
        <div className="inline-field">
          <input
            id="room-code"
            value={joinCode}
            onChange={(event) => setJoinCode(normalizeRoomId(event.target.value))}
            placeholder="ABC123"
            autoComplete="off"
          />
          <button type="submit">Join</button>
        </div>
      </form>
    </section>
  );
}

function JoinScreen({
  roomId,
  onNameSubmit
}: {
  roomId: string;
  onNameSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(getStoredDisplayName());

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim()) onNameSubmit(name);
  }

  return (
    <section className="join-name-layout">
      <form className="join-name" onSubmit={handleSubmit}>
        <span className="section-label">Room {roomId}</span>
        <h1>Join room</h1>
        <label htmlFor="display-name">Display name</label>
        <input
          id="display-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={40}
          placeholder="Your name"
          autoComplete="name"
        />
        <button className="primary-action" type="submit" disabled={!name.trim()}>
          <Users size={18} aria-hidden="true" />
          Enter room
        </button>
      </form>
    </section>
  );
}

function PokerRoom({
  roomId,
  displayName,
  onChangeName
}: {
  roomId: string;
  displayName: string;
  onChangeName: () => void;
}) {
  const { state, status, error, clientId, send } = usePlanningPokerRoom(roomId, displayName);
  const [localVote, setLocalVote] = useState<string | null>(null);
  const roomLink = useMemo(() => getRoomLink(roomId), [roomId]);
  const currentParticipant = state?.participants.find((participant) => participant.id === clientId);

  const fallbackState: PublicRoomState = {
    roomId,
    storyTitle: "",
    deck: "fibonacci",
    revealed: false,
    participants: [],
    updatedAt: Date.now()
  };

  const activeState = state ?? fallbackState;
  const currentVote = activeState.revealed ? currentParticipant?.vote ?? null : localVote;

  useEffect(() => {
    if (!currentParticipant?.voted || activeState.revealed) {
      setLocalVote(activeState.revealed ? currentParticipant?.vote ?? null : null);
    }
  }, [activeState.revealed, currentParticipant?.vote, currentParticipant?.voted]);

  return (
    <section className="room-layout">
      <div className="workspace">
        <RoomHeader
          state={activeState}
          roomLink={roomLink}
          status={status}
          displayName={displayName}
          onChangeName={onChangeName}
        />

        {error ? <div className="error-banner">{error}</div> : null}

        <StoryEditor storyTitle={activeState.storyTitle} onChange={(storyTitle) => send({ type: "setStoryTitle", storyTitle })} />

        <DeckSelector deck={activeState.deck} onChange={(deck) => send({ type: "setDeck", deck })} disabled={activeState.revealed} />

        <EstimateCards
          deck={activeState.deck}
          currentVote={currentVote}
          revealed={activeState.revealed}
          onVote={(vote) => {
            setLocalVote(vote);
            send({ type: "vote", vote });
          }}
        />
        <ControlsPanel
          state={activeState}
          onReveal={() => send({ type: "reveal" })}
          onReset={() => {
            setLocalVote(null);
            send({ type: "reset" });
          }}
        />
      </div>

      <aside className="side-rail">
        <ParticipantsPanel state={activeState} />
        <ResultsPanel state={activeState} />
      </aside>
    </section>
  );
}

function RoomHeader({
  state,
  roomLink,
  status,
  displayName,
  onChangeName
}: {
  state: PublicRoomState;
  roomLink: string;
  status: "connecting" | "connected" | "disconnected";
  displayName: string;
  onChangeName: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyRoomLink() {
    await navigator.clipboard.writeText(roomLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="room-header">
      <div>
        <span className="section-label">Room {state.roomId}</span>
        <h1>{state.storyTitle || "Untitled story"}</h1>
      </div>
      <div className="room-actions">
        <button className="icon-text-button" type="button" onClick={copyRoomLink}>
          {copied ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <button className="ghost-button" type="button" onClick={onChangeName}>
          {displayName}
        </button>
        <span className={`status-dot ${status}`}>
          {status === "connected" ? <Wifi size={15} aria-hidden="true" /> : <WifiOff size={15} aria-hidden="true" />}
          {status}
        </span>
      </div>
    </div>
  );
}

function StoryEditor({
  storyTitle,
  onChange
}: {
  storyTitle: string;
  onChange: (storyTitle: string) => void;
}) {
  const [draft, setDraft] = useState(storyTitle);

  useEffect(() => {
    setDraft(storyTitle);
  }, [storyTitle]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draft !== storyTitle) onChange(draft);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [draft, onChange, storyTitle]);

  return (
    <label className="story-field">
      <span>Story title</span>
      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={120}
        placeholder="Sprint backlog item"
      />
    </label>
  );
}

function DeckSelector({
  deck,
  disabled,
  onChange
}: {
  deck: DeckType;
  disabled: boolean;
  onChange: (deck: DeckType) => void;
}) {
  return (
    <div className="deck-row" role="radiogroup" aria-label="Card deck">
      {(Object.keys(decks) as DeckType[]).map((deckType) => (
        <button
          key={deckType}
          type="button"
          className={deckType === deck ? "selected" : ""}
          onClick={() => onChange(deckType)}
          disabled={disabled}
          role="radio"
          aria-checked={deckType === deck}
        >
          {deckLabels[deckType]}
        </button>
      ))}
    </div>
  );
}

function EstimateCards({
  deck,
  currentVote,
  revealed,
  onVote
}: {
  deck: DeckType;
  currentVote: string | null;
  revealed: boolean;
  onVote: (vote: string) => void;
}) {
  return (
    <div className="estimate-zone">
      <div className="estimate-heading">
        <h2>Estimate</h2>
        <span>{revealed ? "Revealed" : currentVote ? `Selected ${currentVote}` : "No card selected"}</span>
      </div>
      <div className="card-grid">
        {decks[deck].map((card) => (
          <button
            key={card}
            type="button"
            className={card === currentVote ? "estimate-card selected" : "estimate-card"}
            onClick={() => onVote(card)}
            disabled={revealed}
          >
            {card}
          </button>
        ))}
      </div>
    </div>
  );
}

function ParticipantsPanel({ state }: { state: PublicRoomState }) {
  const votedCount = getVotedCount(state.participants);
  const connectedCount = getConnectedCount(state.participants);

  return (
    <section className="rail-panel">
      <div className="panel-title">
        <h2>Participants</h2>
        <span>
          {votedCount}/{state.participants.length}
        </span>
      </div>
      <div className="participant-list">
        {state.participants.length ? (
          state.participants.map((participant) => (
            <div className="participant-row" key={participant.id}>
              <span className={participant.connected ? "presence online" : "presence"} aria-hidden="true" />
              <span className="participant-name">{participant.name}</span>
              <span className={participant.voted ? "vote-state voted" : "vote-state"}>
                {state.revealed && participant.vote ? participant.vote : participant.voted ? "Voted" : "Open"}
              </span>
            </div>
          ))
        ) : (
          <div className="empty-state">Waiting for teammates</div>
        )}
      </div>
      <div className="rail-meta">{connectedCount} connected</div>
    </section>
  );
}

function ControlsPanel({
  state,
  onReveal,
  onReset
}: {
  state: PublicRoomState;
  onReveal: () => void;
  onReset: () => void;
}) {
  const votedCount = getVotedCount(state.participants);

  return (
    <div className="workspace-controls">
      <button className="primary-action" type="button" onClick={onReveal} disabled={state.revealed || votedCount === 0}>
        <Eye size={18} aria-hidden="true" />
        Reveal
      </button>
      <button className="secondary-action" type="button" onClick={onReset}>
        <RotateCcw size={17} aria-hidden="true" />
        Reset
      </button>
    </div>
  );
}

function ResultsPanel({ state }: { state: PublicRoomState }) {
  const [copied, setCopied] = useState(false);
  const voteCounts = getVoteCounts(state.participants);
  const average = getAverageVote(state.participants);
  const mostCommon = getMostCommonVote(state.participants);

  async function copyResult() {
    await navigator.clipboard.writeText(getFinalResultText(state));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <section className="rail-panel results-panel">
      <div className="panel-title">
        <h2>Results</h2>
        {state.revealed ? <span>Final</span> : <span>Hidden</span>}
      </div>

      {state.revealed ? (
        <>
          <div className="result-stats">
            <ResultStat label="Average" value={average === null ? "--" : average.toFixed(1)} />
            <ResultStat label="Mode" value={mostCommon ? mostCommon[0] : "--"} />
          </div>
          <div className="vote-bars">
            {Object.entries(voteCounts).map(([vote, count]) => (
              <div className="vote-bar" key={vote}>
                <span>{vote}</span>
                <div>
                  <i style={{ width: `${Math.max(12, count * 24)}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
          <button className="icon-text-button full-width" type="button" onClick={copyResult}>
            {copied ? <Check size={17} aria-hidden="true" /> : <Clipboard size={17} aria-hidden="true" />}
            {copied ? "Copied" : "Copy result"}
          </button>
        </>
      ) : (
        <div className="empty-state">Votes appear after reveal</div>
      )}
    </section>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="result-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
